import { Directive, Input, TemplateRef, ViewContainerRef } from "@angular/core";
import { AuthService } from "../services/auth.service";

@Directive({
  selector: "[hasRole]",
})
export class HasRoleDirective {
  private expectedRoles: string[] = [];
  private shown = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService,
  ) {}

  @Input()
  set hasRole(value: string[] | string) {
    if (Array.isArray(value)) {
      this.expectedRoles = value;
    } else if (typeof value === "string") {
      this.expectedRoles = [value];
    } else {
      this.expectedRoles = [];
    }
    this.updateView();
  }

  private updateView() {
    const currentRole = this.authService.getUserRole() || "";
    const allowed =
      this.expectedRoles.length === 0 || this.expectedRoles.includes(currentRole);

    if (allowed && !this.shown) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.shown = true;
      return;
    }

    if (!allowed && this.shown) {
      this.viewContainer.clear();
      this.shown = false;
    }
  }
}
