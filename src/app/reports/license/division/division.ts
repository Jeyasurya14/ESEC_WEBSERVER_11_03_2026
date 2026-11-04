import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UserMenu } from '../../../core/models';

/** License / Division. */
@Component({
  selector: 'app-division',
  templateUrl: './division.html',
  styleUrl: './division.scss',
  host: { class: 'report-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Division {
  readonly menu = input.required<UserMenu>();
}
