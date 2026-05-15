import { DisposableBag, type Disposable } from '../lifecycle';
import { bindDialogBackdropDismiss } from './dialog-backdrop';
import type { MetadataDialogElements } from './elements';

interface MetadataDialogCallbacks {
  onBeforeOpen: () => void;
}

export class MetadataDialogController implements Disposable {
  private readonly disposables = new DisposableBag();
  private open = false;
  private disposed = false;

  constructor(
    private readonly elements: MetadataDialogElements,
    private readonly callbacks: MetadataDialogCallbacks
  ) {
    this.disposables.addDisposable(bindDialogBackdropDismiss(this.elements.metadataDialogBackdrop, () => {
      this.close(true);
    }));

    this.disposables.addEventListener(this.elements.appMetadataButton, 'click', () => {
      if (this.open) {
        this.close(true);
        return;
      }

      this.openDialog();
    });

    this.disposables.addEventListener(this.elements.metadataDialogCloseButton, 'click', () => {
      this.close(true);
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.close(false);
    this.disposed = true;
    this.disposables.dispose();
  }

  isOpen(): boolean {
    return this.open;
  }

  setAvailable(available: boolean): void {
    if (this.disposed) {
      return;
    }

    this.elements.appMetadataButton.disabled = !available;
    if (!available) {
      this.close(false);
    }
  }

  openDialog(): void {
    if (this.disposed || this.open || this.elements.appMetadataButton.disabled) {
      return;
    }

    this.callbacks.onBeforeOpen();
    this.open = true;
    this.elements.metadataDialogBackdrop.classList.remove('hidden');
    this.elements.appMetadataButton.setAttribute('aria-expanded', 'true');
    this.elements.metadataDialogCloseButton.focus();
  }

  close(restoreFocus = true): void {
    if (this.disposed) {
      return;
    }

    if (!this.open && this.elements.metadataDialogBackdrop.classList.contains('hidden')) {
      return;
    }

    this.open = false;
    this.elements.metadataDialogBackdrop.classList.add('hidden');
    this.elements.appMetadataButton.setAttribute('aria-expanded', 'false');

    if (restoreFocus) {
      this.elements.appMetadataButton.focus();
    }
  }
}
