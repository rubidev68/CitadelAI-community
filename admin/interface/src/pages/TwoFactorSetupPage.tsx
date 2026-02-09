import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { initiateTwoFactorSetup, verifyTwoFactorSetup } from '@/lib/api';
import { Shield, CheckCircle2, AlertCircle, Copy, Download, ArrowLeft, Key } from 'lucide-react';

const TwoFactorSetupPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [step, setStep] = useState<'loading' | 'qr' | 'verify' | 'success'>('loading');
  const [qrData, setQrData] = useState<{ qrCode: string; manualEntryKey: string; secret: string; setupToken: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    initiateSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  const initiateSetup = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await initiateTwoFactorSetup(token);
      setQrData({
        qrCode: data.qrCode,
        manualEntryKey: data.manualEntryKey,
        secret: data.secret,
        setupToken: data.setupToken
      });
      setStep('qr');
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { error?: string } })?.data?.error
        : err instanceof Error
        ? err.message
        : 'Failed to initiate 2FA setup';
      setError(errorMessage);
      setStep('qr'); // Still show QR step even on error
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || !qrData || !token) return;

    setError('');
    setLoading(true);

    try {
      const response = await verifyTwoFactorSetup(otp, qrData.setupToken, token);
      setBackupCodes(response.backupCodes);
      setStep('success');
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { error?: string } })?.data?.error
        : err instanceof Error
        ? err.message
        : 'Invalid code. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
  };

  const downloadBackupCodes = () => {
    const codesText = `CitadelAI - Backup Codes\n\nSave these codes in a safe place. Each code can only be used once.\n\n${backupCodes.join('\n')}\n\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'citadelai-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyManualKey = () => {
    if (qrData) {
      navigator.clipboard.writeText(qrData.manualEntryKey.replace(/\s/g, ''));
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparing 2FA setup...</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </button>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              2FA Enabled Successfully
            </h1>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-b border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <h2 className="text-xl font-bold text-green-900">Two-Factor Authentication Enabled</h2>
              </div>
              <p className="text-sm text-green-700">
                Your account is now protected with two-factor authentication.
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Backup Codes
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={copyBackupCodes}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                    <button
                      onClick={downloadBackupCodes}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold mb-1">Important: Save these codes!</p>
                      <p>These backup codes can be used to access your account if you lose access to your authenticator app. Each code can only be used once.</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 border border-border rounded-lg p-4 font-mono text-sm space-y-1">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-foreground">{code}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Enable Two-Factor Authentication
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Scan the QR code with your authenticator app</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-border overflow-hidden">
          {step === 'qr' && (
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Step 1: Scan QR Code</h2>
                <p className="text-sm text-muted-foreground">
                  Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code
                </p>
              </div>

              {qrData && (
                <>
                  <div className="flex justify-center">
                    <div className="p-4 bg-white border-2 border-border rounded-lg">
                      <img src={qrData.qrCode} alt="QR Code" className="w-64 h-64" />
                    </div>
                  </div>

                  <div className="border-t border-border pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">Manual Entry Key</label>
                      <button
                        onClick={copyManualKey}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                    <div className="bg-gray-50 border border-border rounded-lg p-3 font-mono text-sm text-center">
                      {qrData.manualEntryKey}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      If you can't scan the QR code, enter this key manually in your app
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setStep('verify')}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  Next: Verify Code
                </button>
              </div>
            </div>
          )}

          {step === 'verify' && (
            <div className="p-6 space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground mb-2">Step 2: Verify Setup</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app to complete setup
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-foreground mb-2">
                    Authentication Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={otp}
                    onChange={handleOtpChange}
                    autoFocus
                    maxLength={6}
                    className="w-full px-4 py-3 text-center text-2xl tracking-widest border-2 border-border rounded-lg focus:outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                    placeholder="000000"
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('qr')}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 border-2 border-border rounded-lg hover:bg-muted transition-colors font-medium disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {loading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetupPage;
