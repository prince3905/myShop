import { Component, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";

import { AddItemsComponent } from "../add-items/add-items.component";
import { ItemService } from "app/shared/services/item.service";
import { Router } from "@angular/router";

@Component({
  selector: "items-list",
  templateUrl: "./items-list.component.html",
  styleUrls: ["./items-list.component.css"],
})
export class ItemsListComponent implements OnInit {
  items: any = [];

  constructor(
    public dialog: MatDialog,
    private item: ItemService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.getAllItems();
  }

  getAllItems(): void {
    this.item.getItem().subscribe(
      (response) => {
        this.items = response;
        console.log("All items here", this.items);
      },

      (error) => {
        console.error("Error retrieving items:", error);
        // Handle error here (e.g., show error message to the user)
      }
    );
  }

  openAddItemModal(): void {
    const dialogRef = this.dialog.open(AddItemsComponent, {
      width: "400px", // Adjust the width as needed
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Handle the result after the modal is closed
      if (result && result.data && result.data.itemName) {
        const newItemName = result.data.itemName;
        // Perform any actions with the new item name here
      }
    });
  }

  viewItemDetails(itemId: string) {
    this.router.navigate(["/item-details", itemId]);
  }
}
