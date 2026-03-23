import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { FactoryProductionService } from "app/shared/services/factory-production.service";
import { RawMaterialService } from "app/shared/services/raw-material.service";
import { ScrapRegisterService } from "app/shared/services/scrap-register.service";
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
    private factoryProductionService: FactoryProductionService,
    private rawMaterialService: RawMaterialService,
    private scrapRegisterService: ScrapRegisterService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;

    forkJoin({
      productionsResponse: this.factoryProductionService.getProductions(this.filters),
      scrapsResponse: this.scrapRegisterService.getScraps(this.filters),
      materialsResponse: this.rawMaterialService.getMaterials({ search: this.filters.search }),
    }).subscribe({
      next: ({ productionsResponse, scrapsResponse, materialsResponse }) => {
        const productions = productionsResponse?.productions || [];
        const scraps = scrapsResponse?.scraps || [];
        const materials = materialsResponse?.materials || [];

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
          materialValue: materials.reduce(
            (sum: number, item: any) => sum + (Number(item?.openingQty || 0) * Number(item?.currentRate || 0)),
            0,
          ),
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
}
