import { Component } from "@angular/core";
import { Router } from "@angular/router";

@Component({
  selector: "app-pos",
  templateUrl: "./pos.component.html",
  styleUrls: ["./pos.component.css"],
})
export class PosComponent {
  constructor(private router: Router) {}

  exitPos(): void {
    this.router.navigate(["/dashboard"]);
  }
}
