'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'email' | 'otp';

export default function LoginButton() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'sign-in',
    });
    setLoading(false);
    if (sendError) {
      setError(sendError.message ?? "Impossible d'envoyer le code");
      return;
    }
    setStep('otp');
  };

  const handleVerifyOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.emailOtp({
      email,
      otp,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? 'Code invalide ou expiré');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  if (step === 'otp') {
    return (
      <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp">Code de connexion</Label>
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            required
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Code envoyé à {email}
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading || otp.length !== 6}>
          {loading ? 'Vérification...' : 'Se connecter'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setStep('email');
            setOtp('');
            setError(null);
          }}
        >
          Utiliser une autre adresse
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email administrateur</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@eba.ci"
          required
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || !email}>
        {loading ? 'Envoi...' : 'Recevoir un code'}
      </Button>
    </form>
  );
}
