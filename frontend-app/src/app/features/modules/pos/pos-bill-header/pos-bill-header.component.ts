import { Component, computed, inject, output } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosActionResult, PosService } from '../../../../core/services/pos.service';
import { ClockService } from '../../../../core/services/clock.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

@Component({
  selector: 'app-pos-bill-header',
  imports: [ButtonComponent, ...FIELD_IMPORTS],
  templateUrl: './pos-bill-header.component.html',
  styleUrl: './pos-bill-header.component.scss',
})
export class PosBillHeaderComponent {
  readonly newBillRequested = output<void>();
  readonly holdRequested = output<void>();

  private readonly notificationService = inject(NotificationService);
  private readonly clockService = inject(ClockService);

  protected readonly posService = inject(PosService);
  protected readonly today = this.clockService.today();
  protected readonly customerName = computed(() => {
    const customerId = this.posService.bill().customerId;
    return this.posService.customers().find(customer => customer.id === customerId)?.name ?? '';
  });
  protected readonly repName = computed(() => {
    const repId = this.posService.bill().repId;
    return this.posService.reps().find(rep => rep.id === repId)?.name ?? '';
  });

  protected onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const result = this.posService.setDate(input.value);
    if (!result.ok) this.notificationService.show('warning', result.message);
    input.value = this.posService.bill().date;
  }

  protected onCustomerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const typed = input.value.trim().toLowerCase();
    const match = this.posService
      .customers()
      .find(customer => customer.name.toLowerCase() === typed);
    const result = match
      ? this.posService.setCustomer(match.id)
      : { ok: false as const, message: 'Choose a customer from the list.' };
    if (!result.ok) this.notificationService.show('warning', result.message);
    input.value = this.customerName();
  }

  protected onRepChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const result = this.chooseRep(input.value.trim().toLowerCase());
    if (!result.ok) this.notificationService.show('warning', result.message);
    input.value = this.repName();
  }

  private chooseRep(typed: string): PosActionResult {
    if (typed.length === 0) return this.posService.setRep(null);
    const match = this.posService.reps().find(rep => rep.name.toLowerCase() === typed);
    if (match === undefined) {
      return { ok: false, message: 'Choose a rep from the list, or leave it empty.' };
    }
    return this.posService.setRep(match.id);
  }
}
