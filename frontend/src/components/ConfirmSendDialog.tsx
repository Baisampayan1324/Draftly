import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Send } from 'lucide-react';

interface ConfirmSendDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  subject?: string;
}

export function ConfirmSendDialog({ open, onClose, onConfirm, subject }: ConfirmSendDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
            <Send className="h-5 w-5 text-success" />
          </div>
          <AlertDialogTitle className="text-xl">Ready to send?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            {subject ? (
              <>Your email "<span className="font-medium text-foreground">{subject}</span>" will be sent. You'll need to connect Gmail first.</>
            ) : (
              <>Your email draft has been approved. Connect Gmail to send it.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-success hover:bg-success/90 text-success-foreground"
          >
            Continue to Send
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
