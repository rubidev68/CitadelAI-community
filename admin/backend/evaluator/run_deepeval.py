#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import re

# Try importing deepeval; fallback if not present
try:
    from deepeval.metrics import AnswerRelevancyMetric
    HAVE_DEEPEVAL = True
except Exception:
    HAVE_DEEPEVAL = False

import json
import requests

def simple_similarity(a: str, b: str) -> float:
    a = (a or '').lower()
    b = (b or '').lower()
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    common = len(set(a.split()) & set(b.split()))
    total = len(set(a.split()) | set(b.split())) or 1
    return common / total


def extract_citations(text: str):
    """Extract cited sources (urls or filenames) from the assistant response.
    We expect a 'Sources' section with markdown links, but also try plain URLs.
    Returns a set of lowercase tokens (urls or filenames).
    """
    text = text or ''
    citations = set()
    # Markdown links [title](url)
    for m in re.finditer(r"\[[^\]]+\]\(([^)]+)\)", text, flags=re.IGNORECASE):
        citations.add(m.group(1).strip().lower())
    # Plain urls
    for m in re.finditer(r"https?://[^\s)]+", text, flags=re.IGNORECASE):
        citations.add(m.group(0).strip().lower())
    # Filenames (common doc extensions)
    for m in re.finditer(r"[\w\-\./]+\.(pdf|docx?|pptx?|html?)", text, flags=re.IGNORECASE):
        citations.add(m.group(0).strip().lower())
    return citations


def match_expected_sources(found: set, expected_list):
    if not expected_list:
        return 1.0  # if nothing expected, treat as fully satisfied
    if not found:
        return 0.0
    found_l = {s.lower() for s in found}
    hits = 0
    total = 0
    for exp in expected_list:
        token = (exp or '').strip().lower()
        if not token:
            continue
        total += 1
        # consider hit if any found citation contains the expected token substring
        if any(token in s for s in found_l):
            hits += 1
    if total == 0:
        return 1.0
    return hits / total


def run(payload: dict) -> dict:
    examples = payload.get('examples', [])
    suites = payload.get('suites', {"qa": True, "rag": True})
    user_api = payload.get('userApiBaseUrl')
    user_token = payload.get('userToken')
    chatbot_id = payload.get('chatbotId')

    results = {
        "id": payload.get('id'),
        "createdAt": payload.get('createdAt'),
        "completedAt": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "summary": {
            "total": len(examples),
            "passed": 0,
            "failed": 0,
            "averageScore": 0.0,
        },
        "cases": []
    }

    scores = []

    session_id = None

    headers = { 'Authorization': f'Bearer {user_token}' } if user_token else {}

    # Create a dedicated chat session for this chatbot to avoid cross-contamination
    try:
        if user_api and chatbot_id and user_token:
            print(f"[evaluator] Creating session: {user_api}/chat chatbotId={chatbot_id}", file=sys.stderr)
            r = requests.post(f"{user_api}/chat", json={"chatbotId": chatbot_id}, headers=headers, timeout=20)
            if r.ok:
                session_id = r.json().get('id')
                print(f"[evaluator] Session created: {session_id}", file=sys.stderr)
            else:
                print(f"[evaluator] Session create failed: {r.status_code} {r.text[:200]}", file=sys.stderr)
    except Exception as e:
        print(f"[evaluator] Session create error: {e}", file=sys.stderr)

    total = len(examples)
    processed = 0

    for idx, ex in enumerate(examples, 1):
        q = ex.get('question', '')
        good = ex.get('answer', '')
        actual = ''
        # Query real bot answer via user API
        try:
            if user_api and user_token:
                body = {"message": q}
                if session_id:
                    body["chatSessionId"] = session_id
                print(f"[evaluator] Q{idx}/{total}: {q[:50]}...", file=sys.stderr)
                r = requests.post(f"{user_api}/chat/respond", json=body, headers=headers, timeout=60)
                if r.ok:
                    data = r.json()
                    actual = data.get('message', '')
                    print(f"[evaluator] Q{idx} response length: {len(actual)}", file=sys.stderr)
                else:
                    print(f"[evaluator] Q{idx} API error: {r.status_code} {r.text[:200]}", file=sys.stderr)
        except Exception as e:
            print(f"[evaluator] Q{idx} exception: {e}", file=sys.stderr)
            actual = ''

        # Metric computation
        if HAVE_DEEPEVAL:
            try:
                metric = AnswerRelevancyMetric()
                score = float(metric.measure(actual_output=actual, expected_output=good, input=q))
            except Exception:
                score = simple_similarity(actual, good)
        else:
            score = simple_similarity(actual, good)

        # QA pass
        qa_pass = (not suites.get('qa', True)) or (score >= 0.1)

        # RAG metric
        expected_sources = ex.get('expectedSources') or ex.get('expected_sources') or []
        found_citations = extract_citations(actual)
        rag_score = match_expected_sources(found_citations, expected_sources) if suites.get('rag', True) else 1.0
        rag_pass = (not suites.get('rag', True)) or (rag_score >= 0.5)

        passed = qa_pass and rag_pass
        scores.append(score)
        results["cases"].append({
            "question": q,
            "expected": good,
            "actual": actual,
            "metrics": {
                "answerRelevancy": score,
                "ragRetrieval": rag_score,
                "expectedSources": expected_sources,
                "foundCitations": sorted(list(found_citations))
            },
            "passed": passed
        })
        # write progress if possible
        try:
            processed += 1
            if '_progress_path' in globals() and globals()['_progress_path']:
                with open(globals()['_progress_path'], 'w') as f:
                    json.dump({"processed": processed, "total": total}, f)
        except Exception:
            pass

    if scores:
        avg = sum(scores) / len(scores)
    else:
        avg = 0.0

    # Update summary to reflect combined pass/fail and averages
    qa_scores = [c["metrics"].get("answerRelevancy", 0.0) for c in results["cases"]]
    rag_scores = [c["metrics"].get("ragRetrieval", 1.0) for c in results["cases"] if suites.get('rag', True)]
    qa_avg = (sum(qa_scores) / len(qa_scores)) if qa_scores else 0.0
    rag_avg = (sum(rag_scores) / len(rag_scores)) if rag_scores else 0.0
    enabled = int(bool(suites.get('qa', True))) + int(bool(suites.get('rag', True)))
    combined_avg = (qa_avg + (rag_avg if suites.get('rag', True) else 0.0)) / (enabled or 1)

    results["summary"]["averageScore"] = combined_avg
    results["summary"]["qaAverage"] = qa_avg
    results["summary"]["ragAverage"] = rag_avg
    results["summary"]["passed"] = sum(1 for c in results["cases"] if c.get('passed'))
    results["summary"]["failed"] = len(results["cases"]) - results["summary"]["passed"]

    # Note: Suite 2 (RAG) placeholders — in a real implementation, add context relevancy metrics
    results["suites"] = suites

    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    try:
        with open(args.input, 'r') as f:
            payload = json.load(f)
        print(f"[evaluator] Loaded payload: id={payload.get('id')} chatbotId={payload.get('chatbotId')} examples={len(payload.get('examples', []))}", file=sys.stderr)
    except Exception as e:
        print(f"Failed to read input: {e}", file=sys.stderr)
        sys.exit(1)

    # Compute progress path from output path
    output_path = args.output
    try:
        progress_path = output_path.replace('-result.json', '-progress.json')
    except Exception:
        progress_path = None
    # Inject progress_path for internal use by run via global
    global _progress_path
    _progress_path = progress_path

    # Monkey patch run to emit progress after each case using _progress_path
    def run_with_progress(payload: dict) -> dict:
        global _progress_path
        examples = payload.get('examples', [])
        total = len(examples)
        # Wrap original run loop by copying code minimally: call run(payload) but also write processed during iteration
        # Since refactor is complex, do a simple two-pass: write 0 progress first, then final progress is handled by result write.
        try:
            if _progress_path:
                with open(_progress_path, 'w') as f:
                    json.dump({"processed": 0, "total": total}, f)
        except Exception:
            pass
        res = run(payload)
        try:
            if _progress_path:
                with open(_progress_path, 'w') as f:
                    json.dump({"processed": total, "total": total}, f)
        except Exception:
            pass
        return res

    res = run_with_progress(payload)

    try:
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, 'w') as f:
            json.dump(res, f, indent=2)
    except Exception as e:
        print(f"Failed to write output: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
