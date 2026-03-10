import { Directive, ElementRef, HostListener, Optional } from "@angular/core";
import { NgControl } from "@angular/forms";

@Directive({
  selector: "[appCapitalizeFirst]",
})
export class CapitalizeFirstDirective {
  constructor(
    private elementRef: ElementRef<HTMLInputElement | HTMLTextAreaElement>,
    @Optional() private ngControl?: NgControl,
  ) {}

  @HostListener("input")
  @HostListener("blur")
  onValueChange(): void {
    const element = this.elementRef.nativeElement;
    const currentValue = `${element.value || ""}`;
    const nextValue = this.capitalizeFirst(currentValue);
    if (nextValue === currentValue) return;

    element.value = nextValue;
    if (this.ngControl?.control) {
      this.ngControl.control.setValue(nextValue, {
        emitEvent: false,
        emitModelToViewChange: false,
        emitViewToModelChange: false,
      });
    }
  }

  private capitalizeFirst(value: string): string {
    return value.replace(/^(\s*)([a-z])/, (_match, spaces: string, first: string) => {
      return `${spaces}${first.toUpperCase()}`;
    });
  }
}
