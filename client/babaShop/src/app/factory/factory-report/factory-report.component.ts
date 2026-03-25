import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { RawMaterialService } from "app/shared/services/raw-material.service";
import { StaffDailyWorkService } from "app/shared/services/staff-daily-work.service";
import { forkJoin } from "rxjs";

@Component({
  selector: "app-factory-report",
  templateUrl: "./factory-report.component.html",
  styleUrls: ["./factory-report.component.css"],
})
export class FactoryReportComponent implements OnInit {
  filters = {
    dateFrom: "",
    dateTo: "",
    search: "",
  };

  loading = false;

  report = {
    productionEntries: 0,
    productionQty: 0,
    productionCost: 0,
    scrapEntries: 0,
    scrapQty: 0,
    scrapValue: 0,
    materialCount: 0,
    materialValue: 0,
    topProducedItems: [] as Array<{ label: string; qty: number; value: number }>,
    scrapBySource: [] as Array<{ label: string; qty: number; count: number }>,
  };

  recentProductions: any[] = [];
  recentScraps: any[] = [];
  rawMaterialSnapshot: any[] = [];

  constructor(
    private staffDailyWorkService: StaffDailyWorkService,
    private rawMaterialService: RawMaterialService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;

    forkJoin({
      dailyWorksResponse: this.staffDailyWorkService.getDailyWorks(this.filters),
      materialsResponse: this.rawMaterialService.getMaterials({ search: this.filters.search }),
    }).subscribe({
      next: ({ dailyWorksResponse, materialsResponse }) => {
        const dailyWorks = (dailyWorksResponse?.dailyWorks || []).filter((row: any) => !!row?.factoryProduct);
        const materials = materialsResponse?.materials || [];
        const productions = this.buildProductionRows(dailyWorks);
        const scraps = this.buildScrapRows(dailyWorks);

        this.recentProductions = productions.slice(0, 8);
        this.recentScraps = scraps.slice(0, 8);
        this.rawMaterialSnapshot = materials.slice(0, 8);

        this.report = {
          productionEntries: productions.length,
          productionQty: productions.reduce((sum: number, item: any) => sum + Number(item?.qtyProduced || 0), 0),
          productionCost: productions.reduce((sum: number, item: any) => sum + Number(item?.totalCost || 0), 0),
          scrapEntries: scraps.length,
          scrapQty: scraps.reduce((sum: number, item: any) => sum + Number(item?.qty || 0), 0),
          scrapValue: scraps.reduce((sum: number, item: any) => sum + Number(item?.estimatedValue || 0), 0),
          materialCount: materials.length,
          materialValue: materials.reduce((sum: number, item: any) => sum + Number(item?.currentBalanceValue || 0), 0),
          topProducedItems: this.buildTopProducedItems(productions),
          scrapBySource: this.buildScrapBySource(scraps),
        };

        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || "Failed to load factory report", "Close", { duration: 2500 });
      },
    });
  }

  resetFilters(): void {
    this.filters = {
      dateFrom: "",
      dateTo: "",
      search: "",
    };
    this.loadReport();
  }

  trackByLabel(index: number, item: any): string {
    return `${item?.label || "row"}-${index}`;
  }

  private buildProductionRows(dailyWorks: any[]): any[] {
    return dailyWorks.map((row: any) => {
      const product = row?.factoryProduct || {};
      const qty = Number(row?.unitsCompleted || 0);
      const materialCost = (product?.standardMaterialLines || []).reduce((sum: number, line: any) => {
        return sum + (Number(line?.qtyPerUnit || 0) * Number(line?.rate || 0) * qty);
      }, 0);
      const labourCost = Number(product?.standardLabourCost || 0) * qty;
      const otherCost = Number(product?.standardOtherCost || 0) * qty;
      return {
        entryDate: row.entryDate,
        itemName: row.factoryProductName || product?.name || row.workItemName || row.workType,
        serialNo: row.staff?.name || "",
        qtyProduced: qty,
        unitLabel: row.unit || product?.unitLabel || "PCS",
        totalCost: materialCost + labourCost + otherCost,
      };
    });
  }

  private buildTopProducedItems(productions: any[]): Array<{ label: string; qty: number; value: number }> {
    const grouped = productions.reduce((acc: Record<string, { label: string; qty: number; value: number }>, item: any) => {
      const label = `${item?.itemName || "Unknown"}`.trim() || "Unknown";
      if (!acc[label]) {
        acc[label] = { label, qty: 0, value: 0 };
      }
      acc[label].qty += Number(item?.qtyProduced || 0);
      acc[label].value += Number(item?.totalCost || 0);
      return acc;
    }, {});

    return (Object.values(grouped) as Array<{ label: string; qty: number; value: number }>)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }

  private buildScrapBySource(scraps: any[]): Array<{ label: string; qty: number; count: number }> {
    const grouped = scraps.reduce((acc: Record<string, { label: string; qty: number; count: number }>, item: any) => {
      const label = `${item?.sourceType || "OTHER"}`.replace(/_/g, " ");
      if (!acc[label]) {
        acc[label] = { label, qty: 0, count: 0 };
      }
      acc[label].qty += Number(item?.qty || 0);
      acc[label].count += 1;
      return acc;
    }, {});

    return (Object.values(grouped) as Array<{ label: string; qty: number; count: number }>)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }

  private buildScrapRows(dailyWorks: any[]): any[] {
    return dailyWorks
      .map((row: any) => {
        const product = row?.factoryProduct || {};
        const qty = Number(row?.unitsCompleted || 0);
        const wasteQty = Number(product?.standardWasteQtyPerUnit || 0) * qty;
        if (wasteQty <= 0) {
          return null;
        }
        return {
          entryDate: row.entryDate,
          itemName: row.factoryProductName || product?.name || "Unknown",
          sourceType: "PRODUCTION",
          sourceRef: row.staff?.name || "",
          qty: wasteQty,
          unitLabel: product?.standardWasteUnitLabel || "KG",
          estimatedValue: Number(product?.standardWasteValuePerUnit || 0) * qty,
        };
      })
      .filter((row: any) => !!row);
  }
}
