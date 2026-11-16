import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'dismissProfileOnOutsideClick($event)',
    '(document:keydown.escape)': 'dismissProfileOnEscape()',
  },
})
export class HeaderComponent {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly profileButton = viewChild<ElementRef<HTMLButtonElement>>('profileButton');

  readonly username = input('');
  readonly showSettings = input(false);
  readonly sidebarVisible = input(true);
  readonly toggleSidebar = output<void>();
  readonly actionSelected = output<string>();
  readonly logoutRequested = output<void>();
  readonly profileOpen = signal(false);
  readonly avatarInitial = computed(() => {
    return (this.username().trim() || 'G').charAt(0).toUpperCase();
  });

  toggleProfile(): void {
    this.profileOpen.set(!this.profileOpen());
  }

  selectAction(action: string): void {
    this.profileOpen.set(false);
    this.actionSelected.emit(action);
  }

  logout(): void {
    this.profileOpen.set(false);
    this.logoutRequested.emit();
  }

  dismissProfileOnOutsideClick(event: MouseEvent): void {
    if (!(event.target instanceof Node) || !this.element.nativeElement.contains(event.target)) {
      this.profileOpen.set(false);
    }
  }

  dismissProfileOnEscape(): void {
    if (this.profileOpen()) {
      this.profileOpen.set(false);
      this.profileButton()?.nativeElement.focus();
    }
  }
}
