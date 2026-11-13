import { ChangeDetectionStrategy, Component, OnChanges, computed, input, output, signal } from '@angular/core';
import { UserMenu } from '../../../core/models';

@Component({
  selector: 'app-sidebar-panel',
  templateUrl: './sidebar-panel.component.html',
  styleUrl: './sidebar-panel.component.scss',
  host: {
    '[class.is-open]': 'isOpen()',
    '[style.--panel-offset-top.px]': 'panelTop()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarPanelComponent implements OnChanges {
  readonly isOpen = input(false);
  readonly panelTop = input(0);
  readonly title = input('');
  readonly icon = input('assets/icons/flaticon/folder.svg');
  readonly screens = input<UserMenu[]>([]);
  readonly selectedMenu = input<UserMenu | null>(null);
  readonly screenSelected = output<UserMenu>();
  readonly closed = output<void>();
  readonly filterText = signal('');

  readonly filteredScreens = computed(() => {
    const searchText = this.filterText().trim().toLowerCase();

    return this.screens().filter((screen) => {
      return screen.subMenuName.toLowerCase().includes(searchText);
    });
  });

  ngOnChanges(): void {
    this.filterText.set('');
  }

  updateFilter(event: Event): void {
    const searchInput = event.target as HTMLInputElement;
    this.filterText.set(searchInput.value);
  }

  selectScreen(screen: UserMenu): void {
    this.screenSelected.emit(screen);
  }
}
