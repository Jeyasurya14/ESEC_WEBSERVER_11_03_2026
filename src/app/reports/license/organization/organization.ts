import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UserMenu } from '../../../core/models';

/** License / Organization. */
@Component({
  selector: 'app-organization',
  templateUrl: './organization.html',
  styleUrl: './organization.scss',
  host: { class: 'report-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Organization {
  readonly menu = input.required<UserMenu>();
}
