import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPendingInvite } from '@/api/pending-invites';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormRow } from '@/components/ui/FormRow';

interface NewClientDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewClientDialog({ open, onClose }: NewClientDialogProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const mutation = useMutation({
    mutationFn: () => createPendingInvite({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-invites'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-clients'] });
      onClose();
      setEmail('');
      setFirstName('');
      setLastName('');
    },
  });

  const handleCreate = () => {
    if (!email.trim() || !firstName.trim() || !lastName.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Pozvat nového klienta"
      maxWidth={420}
      footer={
        <>
          <Button onClick={onClose}>Zrušit</Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={mutation.isPending || !email.trim() || !firstName.trim() || !lastName.trim()}
          >
            {mutation.isPending ? 'Odesílání...' : 'Odeslat pozvánku'}
          </Button>
        </>
      }
    >
      <FormRow>
        <Input
          label="Jméno"
          placeholder="Jan"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          label="Příjmení"
          placeholder="Novák"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </FormRow>
      <Input
        label="Email"
        type="email"
        placeholder="jan@example.cz"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>
        Na zadaný email bude odeslána pozvánka s odkazem pro registraci.
        Klient si po registraci vyplní své údaje sám.
      </p>
      {mutation.isError && (
        <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>
          Chyba při odesílání pozvánky. Zkuste to znovu.
        </p>
      )}
    </Dialog>
  );
}
