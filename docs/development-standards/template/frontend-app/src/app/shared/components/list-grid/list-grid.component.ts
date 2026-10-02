import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'app-list-grid',
  templateUrl: './list-grid.component.html',
  styleUrls: ['./list-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ListGridComponent implements OnInit {
  @Input() dataList: any[] | undefined;
  @Input() showClientName: boolean = false;
  @Input() showStatusCircle: boolean = false;

  @Output() onEditDetails = new EventEmitter<any>();

  filterText: string = '';
  constructor() {}

  ngOnInit(): void {}

  get listValues(): any[] {
    if (!this.dataList) {
      return [];
    }
    const filter = this.filterText.trim().toLowerCase();
    if (!filter) {
      return this.dataList;
    }
    return this.dataList.filter(
      a =>
        (a.code && typeof a.code === 'string' && a.code.toLowerCase().includes(filter)) ||
        (a.name && typeof a.name === 'string' && a.name.toLowerCase().includes(filter))
    );
  }

  getClientName(item: any): string {
    let result = '';
    if (item.client) {
      result = item.client.name;
    }
    return result;
  }

  onSelectedItemChanged(selectedItem: any): void {
    this.onEditDetails.emit(selectedItem);
  }
}
