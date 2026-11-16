import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Organization, ORGANIZATION_IMPORTS } from '../organization/organization';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { ReportData } from '../../../shared/report-data';

@Component({
  selector: 'app-license-department',
  imports: [...ORGANIZATION_IMPORTS],
  templateUrl: '../organization/organization.html',
  styleUrl: '../organization/organization.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportFilters, ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Department extends Organization {}
