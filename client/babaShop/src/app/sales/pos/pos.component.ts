import { Component } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { AddSalesComponent } from "../add-sales/add-sales.component";

@Component({
  selector: "app-pos",
  templateUrl: "./pos.component.html",
  styleUrls: ["./pos.component.css"],
})
export class PosComponent {
  constructor(
    private dialog: MatDialog,
    private router: Router,
  ) {}

  openPosSale(): void {
    const dialogRef = this.dialog.open(AddSalesComponent, {
      width: "1080px",
      maxWidth: "96vw",
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.router.navigate(["/sale-list"], { queryParams: { refresh: Date.now() } });
      }
    });
  }
}
