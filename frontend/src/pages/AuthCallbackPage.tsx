import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { reviewDraft } from '@/lib/api';
import { Loader2, Mail, CheckCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setGmailConnected = useAppStore((s) => s.setGmailConnected);
  const [status, setStatus] = useState<'connecting' | 'success' | 'error'>('connecting');
  const [message, setMessage] = useState('Connecting Gmail...');

  useEffect(() => {
    const connected = searchParams.get('connected');
    const userName = searchParams.get('user_name');
    const userEmail = searchParams.get('user_email');
    const userPicture = searchParams.get('user_picture');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage('Failed to connect Gmail');
      toast.error('Failed to connect Gmail: ' + error);
      localStorage.removeItem('pending_send');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
      return;
    }

    if (connected === 'true') {
      // Save to localStorage and Zustand
      const user = userName && userEmail ? {
        name: decodeURIComponent(userName),
        email: decodeURIComponent(userEmail),
        picture: userPicture ? decodeURIComponent(userPicture) : `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=4285f4&color=fff&size=80`,
      } : null;

      setGmailConnected(true, user);
      
      // Check if there's a pending email to send
      const pendingSendRaw = localStorage.getItem('pending_send');
      if (pendingSendRaw) {
        setStatus('connecting');
        setMessage('Sending your email...');
        
        const pendingSend = JSON.parse(pendingSendRaw);
        localStorage.removeItem('pending_send');
        
        // Send the email
        reviewDraft(pendingSend.thread_id, 'approve', undefined, pendingSend.recipient)
          .then((response) => {
            if (response.status === 'sent') {
              setStatus('success');
              setMessage('Email sent successfully!');
              toast.success('Email sent via Gmail!');
            } else if (response.error) {
              setStatus('error');
              setMessage('Failed to send email');
              toast.error(response.error);
            } else {
              setStatus('success');
              setMessage('Gmail connected!');
              toast.success('Gmail connected!');
            }
            setTimeout(() => {
              navigate('/inbox', { replace: true });
            }, 1500);
          })
          .catch((err) => {
            setStatus('error');
            setMessage('Failed to send email');
            toast.error('Failed to send: ' + (err instanceof Error ? err.message : 'Unknown error'));
            setTimeout(() => {
              navigate('/inbox', { replace: true });
            }, 2000);
          });
      } else {
        // No pending send, just connected
        setStatus('success');
        setMessage('Gmail connected successfully!');
        toast.success('Gmail connected!');
        setTimeout(() => {
          navigate('/inbox', { replace: true });
        }, 1500);
      }
    } else {
      // No connected param, redirect to home
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
    }
  }, [searchParams, setGmailConnected, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="text-center space-y-6 animate-fade-in">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          {status === 'connecting' && (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="h-8 w-8 text-success" />
          )}
          {status === 'error' && (
            <Mail className="h-8 w-8 text-destructive" />
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{message}</h1>
          <p className="text-muted-foreground">
            {status === 'connecting' && 'Please wait...'}
            {status === 'success' && 'Redirecting...'}
            {status === 'error' && 'Redirecting...'}
          </p>
        </div>
      </div>
    </div>
  );
}
