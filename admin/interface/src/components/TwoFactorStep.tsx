import { useState } from 'react';
import { Shield, ArrowLeft, Key } from 'lucide-react';

interface TwoFactorStepProps {
  tempToken: string;
  onVerify: (otp: string, backupCode?: string) => Promise<void>;
  onBack: () => void;
  error?: string;
  loading?: boolean;
}

const TwoFactorStep = ({ tempToken, onVerify, onBack, error, loading }: TwoFactorStepProps) => {
  const [otp, setOtp] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (useBackupCode) {
      if (backupCode.trim().length < 8) {
        return;
      }
      await onVerify('', backupCode.trim().toUpperCase());
    } else {
      if (otp.length !== 6) {
        return;
      }
      await onVerify(otp);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    // Auto-submit when 6 digits are entered
    if (value.length === 6) {
      setTimeout(() => {
        handleSubmit(e);
      }, 100);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Two-Factor Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!useBackupCode ? (
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
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
              className="w-full px-4 py-3 text-center text-2xl tracking-widest border-2 border-gray-200 rounded-lg focus:outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
              placeholder="000000"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="backupCode" className="block text-sm font-medium text-gray-700 mb-2">
              Backup Code
            </label>
            <input
              id="backupCode"
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              autoFocus
              className="w-full px-4 py-3 text-center text-lg tracking-wider border-2 border-gray-200 rounded-lg focus:outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono uppercase"
              placeholder="XXXXXXXX"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Enter one of your backup codes
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setOtp('');
              setBackupCode('');
            }}
            className="text-sm text-primary hover:underline flex items-center gap-1"
            disabled={loading}
          >
            <Key className="h-3 w-3" />
            {useBackupCode ? 'Use authenticator code instead' : 'Use backup code instead'}
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="submit"
            disabled={loading || (!useBackupCode && otp.length !== 6) || (useBackupCode && backupCode.length < 8)}
            className="flex-1 px-4 py-2.5 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary hover:bg-primary/90"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TwoFactorStep;
