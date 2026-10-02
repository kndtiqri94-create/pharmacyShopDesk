import { CUSTOM_ELEMENTS_SCHEMA, ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListGridComponent } from './components/list-grid/list-grid.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialResourceModule } from '../material.module';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { LocalDatePipe } from './pipes/local-date.pipe';
import { SystemProgressComponent } from './components/system-progress/system-progress.component';
import { LanguageSelectorComponent } from './components/language-selector/language-selector.component';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [ListGridComponent, LocalDatePipe, SystemProgressComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    MaterialResourceModule,
    FormsModule,
    ReactiveFormsModule,
    SpinnerComponent,
    LanguageSelectorComponent,
    TranslateModule,
  ],
  exports: [
    ListGridComponent,
    SpinnerComponent,
    LocalDatePipe,
    SystemProgressComponent,
    LanguageSelectorComponent,
    TranslateModule,
  ],
})
export class SharedModule {
  static forRoot(): ModuleWithProviders<SharedModule> {
    return {
      ngModule: SharedModule,
      providers: [],
    };
  }
}
