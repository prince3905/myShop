import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { FactoryProductionService } from "app/shared/services/factory-production.service";
import { FinishedGoodsRegisterService } from "app/shared/services/finished-goods-register.service";
import { MaterialInwardService } from "app/shared/services/material-inward.service";
import { ScrapRegisterService } from "app/shared/services/scrap-register.service";
import { forkJoin } from "rxjs";

@Component({
  selector: "app-factory-daily-costing",
  templateUrl: "./factory-daily-costing.component.html",
  styleUrls: ["./factory-daily-costing.component.css"],
})
export class FactoryDailyCostingComponent implements OnInit {
  filters = {
    dateFrom: this.formatDate(new Date()),
    dateTo: this.formatDate(new Date()),
    search: "",
  };

  loading = false;

  summary = {
    productionCost: 0,
    inwardValue: 0,
    finishedGoodsValue: 0,
    scrapValue: 0,
    netFactoryValue: 0,
    productionQty: 0,
    finishedQty: 0,
    scrapQty: 0,
  };

  costingRows: Array<{
    label: string;
    amount: number;
    qty: number;
    tone: "danger" | "success" | "warning" | "neutral";
    note: string;
  }> = [];

  recentProductions: any[] = [];
  recentFinishedGoods: any[] = [];
  recentInwards: any[] = [];
  recentScraps: any[] = [];

  constructor(
    private factoryProductionService: FactoryProductionService,
    private materialInwardService: MaterialInwardService,
    private finishedGoodsRegisterService: FinishedGoodsRegisterService,
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
      inwardsResponse: this.materialInwardService.getInwards(this.filters),
      finishedGoodsResponse: this.finishedGoodsRegisterService.getFinishedGoods(this.filters),
      scrapsResponse: this.scrapRegisterService.getScraps(this.filters),
    }).subscribe({
      next: ({ productionsResponse, inwardsResponse, finishedGoodsResponse, scrapsResponse }) => {
        const productions = productionsResponse?.productions || [];
        const inwards = inwardsResponse?.inwards || [];
        const finishedGoods = finishedGoodsResponse?.finishedGoods || [];
        const scraps = scrapsResponse?.scraps || [];

        const productionCost = productions.reduce((sum: number, item: any) => sum + Number(item?.totalCost || 0), 0);
        const inwardValue = inwards.reduce((sum: number, item: any) => sum + Number(item?.totalAmount || 0), 0);
        const finishedGoodsValue = finishedGoods.reduce((sum: number, item: any) => sum + Number(item?.totalEstimatedValue || 0), 0);
        const scrapValue = scraps.reduce((sum: number, item: any) => sum + Number(item?.estimatedValue || 0), 0);
        const productionQty = productions.reduce((sum: number, item: any) => sum + Number(item?.qtyProduced || 0), 0);
        const finishedQty = finishedGoods.reduce((sum: number, item: any) => sum + Number(item?.qtyReady || 0), 0);
        const scrapQty = scraps.reduce((sum: number, item: any) => sum + Number(item?.qty || 0), 0);

        this.summary = {
          productionCost,
          inwardValue,
          finishedGoodsValue,
          scrapValue,
          netFactoryValue: finishedGoodsValue + scrapValue - productionCost,
          productionQty,
          finishedQty,
          scrapQty,
        };

        this.costingRows = [
          {
            label: "Production Cost",
            amount: productionCost,
            qty: productionQty,
            tone: "danger",
            note: "Material + labour + other production cost",
          },
          {
            label: "Material Inward Value",
            amount: inwardValue,
            qty: inwards.reduce((sum: number, item: any) => sum + Number(item?.qty || 0), 0),
            tone: "neutral",
            note: "Filtered inward purchase total",
          },
          {
            label: "Finished Goods Value",
            amount: finishedGoodsValue,
            qty: finishedQty,
            tone: "success",
            note: "Ready maal ki estimated total value",
          },
          {
            label: "Scrap Value",
            amount: scrapValue,
            qty: scrapQty,
            tone: "warning",
            note: "Scrap / waste estimated recovery value",
          },
        ];

        this.recentProductions = productions.slice(0, 6);
        this.recentFinishedGoods = finishedGoods.slice(0, 6);
        this.recentInwards = inwards.slice(0, 6);
        this.recentScraps = scraps.slice(0, 6);
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || "Failed to load daily costing report", "Close", { duration: 2500 });
      },
    });
  }

  resetFilters(): void {
    this.filters = {
      dateFrom: this.formatDate(new Date()),
      dateTo: this.formatDate(new Date()),
      search: "",
    };
    this.loadReport();
  }

  trackByRow(index: number, item: any): string {
    return `${item?.label || "row"}-${index}`;
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
