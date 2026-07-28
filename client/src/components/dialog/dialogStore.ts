import { create } from 'zustand';

export type DialogTone = 'default' | 'danger' | 'warning';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type PromptOptions = {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  /** Require at least this many characters after trim. */
  minLength?: number;
  /** Require the trimmed value to equal this exactly (e.g. type DELETE). */
  matchValue?: string;
  inputType?: 'text' | 'password';
};

type AlertOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: DialogTone;
};

type ConfirmDialog = ConfirmOptions & {
  kind: 'confirm';
  resolve: (value: boolean) => void;
};

type PromptDialog = PromptOptions & {
  kind: 'prompt';
  resolve: (value: string | null) => void;
};

type AlertDialog = AlertOptions & {
  kind: 'alert';
  resolve: () => void;
};

export type ActiveDialog = ConfirmDialog | PromptDialog | AlertDialog;

type DialogState = {
  dialog: ActiveDialog | null;
  open: (dialog: ActiveDialog) => void;
  close: () => void;
};

export const useDialogStore = create<DialogState>((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));

function openDialog<T>(
  build: (resolve: (value: T) => void) => ActiveDialog,
): Promise<T> {
  return new Promise((resolve) => {
    useDialogStore.getState().open(build(resolve));
  });
}

export const dialog = {
  confirm(options: ConfirmOptions): Promise<boolean> {
    return openDialog<boolean>((resolve) => ({
      kind: 'confirm',
      tone: 'default',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      ...options,
      resolve: (value) => {
        useDialogStore.getState().close();
        resolve(value);
      },
    }));
  },

  prompt(options: PromptOptions): Promise<string | null> {
    return openDialog<string | null>((resolve) => ({
      kind: 'prompt',
      tone: 'default',
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
      label: 'Value',
      ...options,
      resolve: (value) => {
        useDialogStore.getState().close();
        resolve(value);
      },
    }));
  },

  alert(options: AlertOptions): Promise<void> {
    return openDialog<void>((resolve) => ({
      kind: 'alert',
      tone: 'default',
      confirmLabel: 'OK',
      ...options,
      resolve: () => {
        useDialogStore.getState().close();
        resolve();
      },
    }));
  },
};
