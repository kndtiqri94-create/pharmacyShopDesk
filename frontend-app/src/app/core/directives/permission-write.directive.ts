import {
  Directive,
  EmbeddedViewRef,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PermissionService } from '../services/permission.service';

@Directive({
  selector: '[appCanWrite]',
})
export class CanWriteDirective {
  readonly appCanWrite = input.required<ModuleKey>();

  private readonly templateRef = inject(TemplateRef);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly permissionService = inject(PermissionService);
  private view: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const allowed = this.permissionService.canWrite(this.appCanWrite());
      if (allowed && this.view === null) {
        this.view = this.viewContainerRef.createEmbeddedView(this.templateRef);
      } else if (!allowed && this.view !== null) {
        this.viewContainerRef.clear();
        this.view = null;
      }
    });
  }
}
