import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <div className="space-y-6 text-foreground">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using CitadelAI ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use the Service.
                </p>
                <p>
                  These Terms of Service apply to all users of the Service, including without limitation users who are browsers, vendors, customers, merchants, and/or contributors of content.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
                <p>
                  CitadelAI is an AI-powered chatbot platform that enables organizations to create, deploy, and manage intelligent conversational agents with advanced knowledge integration capabilities. The Service includes:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>AI chatbot creation and management tools with visual block editor</li>
                  <li>Web crawling and content integration services with scheduled updates</li>
                  <li>Knowledge base management with vector search capabilities</li>
                  <li>Multiple AI provider support (Google Gemini, OpenAI, Anthropic, Mistral)</li>
                  <li>Real-time streaming responses with Server-Sent Events (SSE)</li>
                  <li>Analytics and reporting features</li>
                  <li>User access management and authentication</li>
                  <li>Document processing and vectorization (PDF support)</li>
                  <li>Citation management and source attribution</li>
                </ul>
                <p className="mt-4">
                  CitadelAI is available in two editions: a <strong>Business Edition</strong> (proprietary) with full enterprise features including billing, advanced analytics, dedicated instance provisioning, and premium support, and a <strong>Community Edition</strong> (open source) available under the Apache 2.0 license with core features for individuals and small teams. The Business Edition also offers dedicated instances for enterprise customers, providing isolated infrastructure with custom resource allocation and subdomain access.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Beta Service</h2>
                <p>
                  You acknowledge that CitadelAI is currently in beta. As a beta service:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>The Service may contain bugs, errors, and other issues</li>
                  <li>Features may change or be removed without notice</li>
                  <li>We do not guarantee uninterrupted or error-free service</li>
                  <li>We reserve the right to modify or discontinue the Service at any time</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Account Registration</h2>
                <p>
                  To use the Service, you must:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide accurate, current, and complete information during registration</li>
                  <li>Maintain and update your registration information to keep it accurate</li>
                  <li>Maintain the security of your password and account</li>
                  <li>Accept all responsibility for activities that occur under your account</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                </ul>
                <p className="mt-4">
                  You must be at least 18 years old to use the Service. By registering, you represent and warrant that you are at least 18 years of age.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Subscription and Billing</h2>
                <p>
                  The Service may offer subscription plans with different features and pricing. By subscribing:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You agree to pay all fees associated with your subscription</li>
                  <li>Fees are billed in advance on a monthly or annual basis</li>
                  <li>Subscriptions automatically renew unless cancelled</li>
                  <li>You may cancel your subscription at any time</li>
                  <li>Refunds are provided according to our refund policy (see Section 6)</li>
                  <li>We use Stripe for payment processing</li>
                </ul>
                <p className="mt-4">
                  We reserve the right to change our pricing with 30 days' notice. Price changes will not affect your current billing period but will apply to subsequent renewals.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Refund Policy</h2>
                <p>
                  During the trial period, you may cancel your subscription at any time without charge. After the trial period:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Refunds are provided on a case-by-case basis</li>
                  <li>Refund requests must be submitted within 14 days of payment</li>
                  <li>Refunds may be pro-rated based on usage</li>
                  <li>We reserve the right to deny refunds for abuse or violation of these Terms</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Acceptable Use</h2>
                <p>
                  You agree not to use the Service to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe upon the rights of others</li>
                  <li>Transmit harmful, offensive, or illegal content</li>
                  <li>Attempt to gain unauthorized access to the Service or related systems</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Use the Service for any fraudulent or malicious purpose</li>
                  <li>Reverse engineer, decompile, or disassemble the Service</li>
                  <li>Use automated systems to access the Service without authorization</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
                <p>
                  The Service and its original content, features, and functionality are owned by CitadelAI and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
                </p>
                <p className="mt-4">
                  You retain ownership of any content you create using the Service. By using the Service, you grant CitadelAI a license to use, store, and process your content solely for the purpose of providing the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. User Content</h2>
                <p>
                  You are responsible for all content you upload, create, or transmit through the Service. You represent and warrant that:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You have the right to use and share the content</li>
                  <li>The content does not violate any third-party rights</li>
                  <li>The content complies with all applicable laws</li>
                </ul>
                <p className="mt-4">
                  We reserve the right to remove any content that violates these Terms or is otherwise objectionable.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Third-Party Services</h2>
                <p>
                  The Service may integrate with third-party services, including but not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>AI providers (Google Gemini, OpenAI, Anthropic, Mistral)</li>
                  <li>Payment processors (Stripe)</li>
                  <li>Hosting and infrastructure providers</li>
                </ul>
                <p className="mt-4">
                  Your use of third-party services is subject to their respective terms of service and privacy policies. We are not responsible for the practices of third-party services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Limitation of Liability</h2>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, CITADELAI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
                </p>
                <p className="mt-4">
                  IN NO EVENT SHALL CITADELAI'S TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID TO CITADELAI IN THE TWELVE (12) MONTHS PRIOR TO THE ACTION GIVING RISE TO THE LIABILITY.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Disclaimer of Warranties</h2>
                <p>
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
                </p>
                <p className="mt-4">
                  We do not warrant that the Service will be uninterrupted, secure, or error-free, or that defects will be corrected.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Termination</h2>
                <p>
                  We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including if you breach these Terms.
                </p>
                <p className="mt-4">
                  Upon termination, your right to use the Service will cease immediately. You may terminate your account at any time by contacting us or using the account deletion feature in your settings.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">14. Changes to Terms</h2>
                <p>
                  We reserve the right to modify these Terms at any time. We will notify users of any material changes by:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Posting the updated Terms on our website</li>
                  <li>Sending an email notification to registered users</li>
                  <li>Displaying a notice in the Service</li>
                </ul>
                <p className="mt-4">
                  Your continued use of the Service after changes become effective constitutes acceptance of the new Terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">15. Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of France, without regard to its conflict of law provisions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">16. Contact Information</h2>
                <p>
                  If you have any questions about these Terms of Service, please contact us at:
                </p>
                <p className="mt-2">
                  <strong>CitadelAI</strong><br />
                  Owner: Anatole CONRAD<br />
                  Email: <a href="mailto:contact@citadelai.app" className="text-primary hover:underline">contact@citadelai.app</a><br />
                  LinkedIn: <a href="https://linkedin.com/in/anatole-conrad" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">linkedin.com/in/anatole-conrad</a>
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">17. Severability</h2>
                <p>
                  If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">18. Entire Agreement</h2>
                <p>
                  These Terms constitute the entire agreement between you and CitadelAI regarding the use of the Service and supersede all prior agreements and understandings.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;
