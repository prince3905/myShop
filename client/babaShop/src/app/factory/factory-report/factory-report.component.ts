import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
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
    materialUsedQty: 0,
    materialValue: 0,
    topProducedItems: [] as Array<{ label: string; qty: number; value: number }>,
    workerProduction: [] as Array<{ label: string; qty: number; earned: number; count: number }>,
    scrapBySource: [] as Array<{ label: string; qty: number; count: number }>,
    wasteByWorker: [] as Array<{ label: string; qty: number; value: number; count: number }>,
  };

  recentProductions: any[] = [];
  recentScraps: any[] = [];
  rawMaterialSnapshot: any[] = [];
  selectedProduction: any | null = null;

  constructor(
    private staffDailyWorkService: StaffDailyWorkService,
    private rawMaterialService: RawMaterialService,
    public authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  get canViewSensitivePricing(): boolean {
    return this.authService.canViewSensitivePricing();
  }

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
        const dailyWorks = (dailyWorksResponse?.dailyWorks || []).filter((row: any) =>
          !!row?.factoryProduct && ["APPROVED", "PARTIAL"].includes(`${row?.verificationStatus || ""}`),
        );
        const materials = materialsResponse?.materials || [];
        const productions = this.buildProductionRows(dailyWorks);
        const scraps = this.buildScrapRows(dailyWorks);

        this.recentProductions = productions.slice(0, 8);
        this.recentScraps = scraps.slice(0, 8);
        this.rawMaterialSnapshot = materials;
        this.selectedProduction = this.recentProductions[0] || null;

        this.report = {
          productionEntries: productions.length,
          productionQty: productions.reduce((sum: number, item: any) => sum + Number(item?.qtyProduced || 0), 0),
          productionCost: productions.reduce((sum: number, item: any) => sum + Number(item?.totalCost || 0), 0),
          scrapEntries: scraps.length,
          scrapQty: scraps.reduce((sum: number, item: any) => sum + Number(item?.qty || 0), 0),
          scrapValue: scraps.reduce((sum: number, item: any) => sum + Number(item?.estimatedValue || 0), 0),
          materialCount: materials.length,
          materialUsedQty: materials.reduce((sum: number, item: any) => sum + Number(item?.consumedQty || 0), 0),
          materialValue: materials.reduce((sum: number, item: any) => sum + Number(item?.currentBalanceValue || 0), 0),
          topProducedItems: this.buildTopProducedItems(productions),
          workerProduction: this.buildWorkerProduction(dailyWorks),
          scrapBySource: this.buildScrapBySource(scraps),
          wasteByWorker: this.buildWasteByWorker(scraps),
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

  selectProduction(item: any): void {
    this.selectedProduction = item || null;
  }

  private buildProductionRows(dailyWorks: any[]): any[] {
    return dailyWorks.map((row: any) => {
      const product = row?.factoryProduct || {};
      const qty = Number(row?.unitsCompleted || 0);
      const materialLines = (product?.standardMaterialLines || []).map((line: any) => {
        const usedQty = Number(line?.qtyPerUnit || 0) * qty;
        const label = `${line?.materialName || line?.rawMaterial?.name || "Material"}`.trim();
        const unit = `${line?.unitLabel || "PCS"}`.trim();
        return {
          label,
          qty: usedQty,
          unit,
          rate: Number(line?.rate || 0),
          cost: usedQty * Number(line?.rate || 0),
        };
      }).filter((line: any) => line.qty > 0);

      const materialCost = materialLines.reduce((sum: number, line: any) => {
        return sum + Number(line?.cost || 0);
      }, 0);

      const labourCost = Number(product?.standardLabourCost || 0) * qty;
      const otherCost = Number(product?.standardOtherCost || 0) * qty;
      const wasteQty = Number(product?.standardWasteQtyPerUnit || 0) * qty;
      const wasteValue = Number(product?.standardWasteValuePerUnit || 0) * qty;
      const workerCost = Number(row?.earnedAmount || 0);
      const factoryCost = materialCost + labourCost + otherCost;
      const actualBatchCost = materialCost + workerCost + otherCost;

      return {
        sourceId: row?._id || null,
        entryDate: row.entryDate,
        itemName: row.factoryProductName || product?.name || row.workItemName || row.workType,
        serialNo: row.staff?.name || "",
        workerName: row.staff?.name || "",
        qtyProduced: qty,
        unitLabel: row.unit || product?.unitLabel || "PCS",
        totalCost: factoryCost,
        costPerUnit: qty > 0 ? factoryCost / qty : 0,
        workerCost,
        actualBatchCost,
        actualCostPerUnit: qty > 0 ? actualBatchCost / qty : 0,
        materialCost,
        labourCost,
        otherCost,
        materialLines,
        wasteQty,
        wasteUnitLabel: product?.standardWasteUnitLabel || "KG",
        wasteValue,
        earnedAmount: Number(row?.earnedAmount || 0),
        workerRatePerUnit: qty > 0 ? workerCost / qty : Number(product?.workerPieceRate || row?.pieceRate || 0),
        linkedJob: row?.linkedJob || "",
        workDetails: row?.workDetails || "",
        note: row?.note || "",
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

  private buildWorkerProduction(dailyWorks: any[]): Array<{ label: string; qty: number; earned: number; count: number }> {
    const grouped = dailyWorks.reduce((acc: Record<string, { label: string; qty: number; earned: number; count: number }>, row: any) => {
      const label = `${row?.staff?.name || "Unknown Worker"}`.trim();
      if (!acc[label]) {
        acc[label] = { label, qty: 0, earned: 0, count: 0 };
      }
      acc[label].qty += Number(row?.unitsCompleted || 0);
      acc[label].earned += Number(row?.earnedAmount || 0);
      acc[label].count += 1;
      return acc;
    }, {});

    return (Object.values(grouped) as Array<{ label: string; qty: number; earned: number; count: number }>)
      .sort((a, b) => b.qty - a.qty || b.earned - a.earned)
      .slice(0, 8);
  }

  private buildWasteByWorker(scraps: any[]): Array<{ label: string; qty: number; value: number; count: number }> {
    const grouped = scraps.reduce((acc: Record<string, { label: string; qty: number; value: number; count: number }>, row: any) => {
      const label = `${row?.sourceRef || "Unknown Worker"}`.trim() || "Unknown Worker";
      if (!acc[label]) {
        acc[label] = { label, qty: 0, value: 0, count: 0 };
      }
      acc[label].qty += Number(row?.qty || 0);
      acc[label].value += Number(row?.estimatedValue || 0);
      acc[label].count += 1;
      return acc;
    }, {});

    return (Object.values(grouped) as Array<{ label: string; qty: number; value: number; count: number }>)
      .sort((a, b) => b.qty - a.qty || b.value - a.value)
      .slice(0, 8);
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
