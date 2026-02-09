import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
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
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <div className="space-y-6 text-foreground">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p>
                  CitadelAI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered chatbot platform ("the Service").
                </p>
                <p className="mt-4">
                  Please read this Privacy Policy carefully. By using the Service, you agree to the collection and use of information in accordance with this policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                
                <h3 className="text-xl font-semibold mb-3 mt-4">2.1 Information You Provide</h3>
                <p>We collect information that you provide directly to us, including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Information:</strong> Name, email address, password, company name</li>
                  <li><strong>Profile Information:</strong> Any additional information you choose to provide in your profile</li>
                  <li><strong>Content:</strong> Chatbot configurations, knowledge base content, chat messages, and other content you create or upload</li>
                  <li><strong>Payment Information:</strong> Billing details processed through Stripe (we do not store credit card information)</li>
                  <li><strong>Communication:</strong> Information you provide when contacting support or participating in surveys</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-4">2.2 Automatically Collected Information</h3>
                <p>When you use the Service, we automatically collect certain information, including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Usage Data:</strong> How you interact with the Service, features used, time spent, and actions taken</li>
                  <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
                  <li><strong>Log Data:</strong> Server logs, error reports, and diagnostic information</li>
                  <li><strong>Cookies and Tracking:</strong> Information collected through cookies and similar technologies</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-4">2.3 Information from Third Parties</h3>
                <p>We may receive information from third-party services you connect to the Service, such as:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Social media platforms (if you use social login)</li>
                  <li>Payment processors (Stripe)</li>
                  <li>AI service providers (Google, OpenAI, Anthropic, Mistral)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                <p>We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide, maintain, and improve the Service</li>
                  <li>Process your registration and manage your account</li>
                  <li>Process payments and manage subscriptions</li>
                  <li>Send you service-related communications</li>
                  <li>Respond to your inquiries and provide customer support</li>
                  <li>Monitor and analyze usage patterns and trends</li>
                  <li>Detect, prevent, and address technical issues and security threats</li>
                  <li>Comply with legal obligations</li>
                  <li>Enforce our Terms of Service</li>
                  <li>Send you marketing communications (with your consent, where required)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. How We Share Your Information</h2>
                <p>We do not sell your personal information. We may share your information in the following circumstances:</p>

                <h3 className="text-xl font-semibold mb-3 mt-4">4.1 Service Providers</h3>
                <p>We share information with third-party service providers who perform services on our behalf, including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Payment Processing:</strong> Stripe for payment processing</li>
                  <li><strong>AI Services:</strong> Google Gemini, OpenAI, Anthropic, Mistral for AI functionality</li>
                  <li><strong>Hosting:</strong> Cloud hosting providers for infrastructure</li>
                  <li><strong>Analytics:</strong> Service providers for usage analytics</li>
                </ul>
                <p className="mt-4">
                  These service providers are contractually obligated to protect your information and use it only for the purposes we specify.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-4">4.2 Legal Requirements</h3>
                <p>We may disclose your information if required by law or in response to valid requests by public authorities.</p>

                <h3 className="text-xl font-semibold mb-3 mt-4">4.3 Business Transfers</h3>
                <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</p>

                <h3 className="text-xl font-semibold mb-3 mt-4">4.4 With Your Consent</h3>
                <p>We may share your information with your explicit consent or at your direction.</p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
                <p>
                  We implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction. These measures include:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security assessments and updates</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Secure password storage using industry-standard hashing</li>
                  <li>Regular backups and disaster recovery procedures</li>
                </ul>
                <p className="mt-4">
                  However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
                <p>
                  We retain your information for as long as necessary to provide the Service and fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.
                </p>
                <p className="mt-4">
                  When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal, regulatory, or legitimate business purposes. Some information may remain in our backups for a limited period.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Your Rights and Choices</h2>
                <p>Depending on your location, you may have certain rights regarding your personal information:</p>

                <h3 className="text-xl font-semibold mb-3 mt-4">7.1 Access and Portability</h3>
                <p>You have the right to access and receive a copy of your personal information.</p>

                <h3 className="text-xl font-semibold mb-3 mt-4">7.2 Correction</h3>
                <p>You can update your account information at any time through your account settings.</p>

                <h3 className="text-xl font-semibold mb-3 mt-4">7.3 Deletion</h3>
                <p>You can request deletion of your account and personal information through your account settings or by contacting us.</p>

                <h3 className="text-xl font-semibold mb-3 mt-4">7.4 Objection and Restriction</h3>
                <p>You may object to certain processing of your information or request restriction of processing.</p>

                <h3 className="text-xl font-semibold mb-3 mt-4">7.5 Withdraw Consent</h3>
                <p>Where processing is based on consent, you may withdraw your consent at any time.</p>

                <h3 className="text-xl font-semibold mb-3 mt-4">7.6 Opt-Out</h3>
                <p>You can opt out of marketing communications by following the unsubscribe instructions in our emails or by contacting us.</p>

                <p className="mt-4">
                  To exercise these rights, please contact us using the information provided in Section 11. We will respond to your request within a reasonable timeframe.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Cookies and Tracking Technologies</h2>
                <p>
                  We use cookies and similar tracking technologies to track activity on the Service and store certain information. Cookies are files with a small amount of data that may include an anonymous unique identifier.
                </p>
                <p className="mt-4">
                  You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. International Data Transfers</h2>
                <p>
                  Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.
                </p>
                <p className="mt-4">
                  When we transfer information internationally, we ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
                <p>
                  The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any changes by:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Posting the new Privacy Policy on this page</li>
                  <li>Sending you an email notification</li>
                  <li>Displaying a notice in the Service</li>
                </ul>
                <p className="mt-4">
                  The "Last updated" date at the top of this Privacy Policy indicates when it was last revised. You are advised to review this Privacy Policy periodically for any changes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
                <p>
                  If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
                </p>
                <p className="mt-2">
                  <strong>CitadelAI</strong><br />
                  Owner: Anatole CONRAD<br />
                  Email: <a href="mailto:contact@citadelai.app" className="text-primary hover:underline">contact@citadelai.app</a><br />
                  LinkedIn: <a href="https://linkedin.com/in/anatole-conrad" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">linkedin.com/in/anatole-conrad</a>
                </p>
                <p className="mt-4">
                  For privacy-related requests or to exercise your rights, please contact us through the above channels.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. GDPR Compliance (EU Users)</h2>
                <p>
                  If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Right to access your personal data</li>
                  <li>Right to rectification of inaccurate data</li>
                  <li>Right to erasure ("right to be forgotten")</li>
                  <li>Right to restrict processing</li>
                  <li>Right to data portability</li>
                  <li>Right to object to processing</li>
                  <li>Right to withdraw consent</li>
                  <li>Right to lodge a complaint with a supervisory authority</li>
                </ul>
                <p className="mt-4">
                  Our legal basis for processing your personal data includes: performance of a contract, legitimate interests, compliance with legal obligations, and your consent.
                </p>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
