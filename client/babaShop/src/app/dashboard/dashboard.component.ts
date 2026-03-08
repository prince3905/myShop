import { Component, OnDestroy, OnInit } from "@angular/core";
import * as Chartist from "chartist";
import { ShopService } from "./../shared/services/shop.service";
import { AuthService } from "../shared/services/auth.service";
import { DashboardService } from "app/shared/services/dashboard.service";
import { forkJoin } from "rxjs";
import { ProductService } from "app/shared/services/product.service";
import { CategoryService } from "app/shared/services/category.service";
import { BrandService } from "app/shared/services/brand.service";
import { Router } from "@angular/router";

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.css"],
})
export class DashboardComponent implements OnInit, OnDestroy {
  shops: any[] = [];
  selectedShop: string | null = null;
  isSuperAdmin = false;
  loadingKpis = false;
  kpis: any = {
    todaySales: 0,
    todayOrders: 0,
    todayPurchase: 0,
    lowStockCount: 0,
    activeShops: 0,
    totalCustomers: 0,
    distributorDue: 0,
    mode: "SHOP_WISE",
  };
  inventorySummary = {
    products: 0,
    categories: 0,
    brands: 0,
  };
  trendDays = 7;
  purchaseAnalytics: any = {
    today: { totalAmount: 0, totalPaid: 0, totalDue: 0, count: 0 },
    weekly: { totalAmount: 0, totalPaid: 0, totalDue: 0, count: 0 },
    monthly: { totalAmount: 0, totalPaid: 0, totalDue: 0, count: 0 },
  };
  returnAnalytics: any = {
    today: { totalAmount: 0, totalRefund: 0, totalCredit: 0, totalQty: 0, count: 0 },
    weekly: { totalAmount: 0, totalRefund: 0, totalCredit: 0, totalQty: 0, count: 0 },
    monthly: { totalAmount: 0, totalRefund: 0, totalCredit: 0, totalQty: 0, count: 0 },
  };
  overview: any = {
    lowStockItems: [],
    recentOrders: [],
    recentSales: [],
    topSellingProducts: [],
    recentPayments: [],
    dueSummary: null,
  };
  private chartTooltipEl: HTMLDivElement | null = null;
  constructor(
    private shopService: ShopService,
    private authService: AuthService,
    private dashboardService: DashboardService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private brandService: BrandService,
    private router: Router,
  ) {}

  startAnimationForLineChart(chart) {
    let seq: any, delays: any, durations: any;
    seq = 0;
    delays = 80;
    durations = 500;

    chart.on("draw", function (data) {
      if (data.type === "line" || data.type === "area") {
        data.element.animate({
          d: {
            begin: 600,
            dur: 700,
            from: data.path
              .clone()
              .scale(1, 0)
              .translate(0, data.chartRect.height())
              .stringify(),
            to: data.path.clone().stringify(),
            easing: Chartist.Svg.Easing.easeOutQuint,
          },
        });
      } else if (data.type === "point") {
        seq++;
        data.element.animate({
          opacity: {
            begin: seq * delays,
            dur: durations,
            from: 0,
            to: 1,
            easing: "ease",
          },
        });
      }
    });

    seq = 0;
  }
  startAnimationForBarChart(chart) {
    let seq2: any, delays2: any, durations2: any;

    seq2 = 0;
    delays2 = 80;
    durations2 = 500;
    chart.on("draw", function (data) {
      if (data.type === "bar") {
        seq2++;
        data.element.animate({
          opacity: {
            begin: seq2 * delays2,
            dur: durations2,
            from: 0,
            to: 1,
            easing: "ease",
          },
        });
      }
    });

    seq2 = 0;
  }

  private ensureChartTooltip(): HTMLDivElement | null {
    if (typeof document === "undefined") {
      return null;
    }

    if (!this.chartTooltipEl) {
      const tooltip = document.createElement("div");
      tooltip.className = "dashboard-chart-tooltip";
      tooltip.style.position = "absolute";
      tooltip.style.zIndex = "2000";
      tooltip.style.pointerEvents = "none";
      tooltip.style.opacity = "0";
      tooltip.style.transform = "translateY(4px)";
      tooltip.style.transition = "opacity 0.12s ease, transform 0.12s ease";
      tooltip.style.padding = "6px 10px";
      tooltip.style.borderRadius = "8px";
      tooltip.style.background = "rgba(15, 23, 42, 0.92)";
      tooltip.style.color = "#fff";
      tooltip.style.fontSize = "12px";
      tooltip.style.fontWeight = "600";
      tooltip.style.whiteSpace = "nowrap";
      tooltip.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.24)";
      document.body.appendChild(tooltip);
      this.chartTooltipEl = tooltip;
    }

    return this.chartTooltipEl;
  }

  private showChartTooltip(event: MouseEvent, text: string): void {
    const tooltip = this.ensureChartTooltip();
    if (!tooltip) {
      return;
    }

    tooltip.textContent = text;
    tooltip.style.opacity = "1";
    tooltip.style.transform = "translateY(0)";
    tooltip.style.left = `${event.pageX + 12}px`;
    tooltip.style.top = `${event.pageY - 36}px`;
  }

  private moveChartTooltip(event: MouseEvent): void {
    if (!this.chartTooltipEl) {
      return;
    }

    this.chartTooltipEl.style.left = `${event.pageX + 12}px`;
    this.chartTooltipEl.style.top = `${event.pageY - 36}px`;
  }

  private hideChartTooltip(): void {
    if (!this.chartTooltipEl) {
      return;
    }

    this.chartTooltipEl.style.opacity = "0";
    this.chartTooltipEl.style.transform = "translateY(4px)";
  }

  private attachPointTooltips(chart: any, labels: string[], values: number[], valuePrefix = ""): void {
    chart.on("draw", (data: any) => {
      if (data.type !== "point" && data.type !== "bar") {
        return;
      }

      const label = labels[data.index] ?? "";
      const value = Number(values[data.index] ?? 0);
      const tooltipText = `${label}: ${valuePrefix}${value.toLocaleString("en-IN")}`;
      const node = data.element?._node as HTMLElement | undefined;

      if (!node || node.dataset.tooltipBound === "true") {
        return;
      }

      node.dataset.tooltipBound = "true";
      node.addEventListener("mouseenter", (event: Event) => {
        this.showChartTooltip(event as MouseEvent, tooltipText);
      });
      node.addEventListener("mousemove", (event: Event) => {
        this.moveChartTooltip(event as MouseEvent);
      });
      node.addEventListener("mouseleave", () => {
        this.hideChartTooltip();
      });
    });
  }

  ngOnInit() {
    this.selectedShop = this.shopService.getSelectedShop();
    this.isSuperAdmin = this.authService.isSuperAdmin();

    if (this.isSuperAdmin) {
      this.loadShops();
    }
    this.loadKpis();
    this.loadOverview();
    this.loadTrends();
    this.loadInventorySummary();
    if (this.canViewSensitivePricing) {
      this.loadPurchaseAnalytics();
    }
    this.loadReturnAnalytics();
  }

  ngOnDestroy(): void {
    if (this.chartTooltipEl?.parentNode) {
      this.chartTooltipEl.parentNode.removeChild(this.chartTooltipEl);
    }
    this.chartTooltipEl = null;
  }

  loadShops() {
    this.shopService.getAllShops().subscribe((res: any) => {
      if (res.success) {
        const user = this.authService.getCurrentUser();
        const scopedShopId = user?.shop || null;
        const scopedShopCode = user?.shopCode || null;

        if (scopedShopId) {
          this.shops = (res.data || []).filter((shop: any) => shop._id === scopedShopId);
          this.selectedShop = scopedShopId;
          this.shopService.setSelectedShop(scopedShopId, scopedShopCode);
        } else {
          this.shops = res.data; // global for super admin without shop
        }
        this.loadKpis();
        this.loadOverview();
        this.loadTrends();
        this.loadInventorySummary();
        if (this.canViewSensitivePricing) {
          this.loadPurchaseAnalytics();
        }
        this.loadReturnAnalytics();
      }
    });
  }

  loadKpis() {
    this.loadingKpis = true;
    this.dashboardService.getKpis().subscribe({
      next: (res: any) => {
        this.kpis = {
          ...this.kpis,
          ...(res?.data || {}),
        };
        this.loadingKpis = false;
      },
      error: () => {
        this.loadingKpis = false;
      },
    });
  }

  get canViewSensitivePricing(): boolean {
    return this.authService.canViewSensitivePricing();
  }

  get userRole(): string {
    return this.authService.getUserRole() || "";
  }

  get isManager(): boolean {
    return this.userRole === "MANAGER";
  }

  get isStaff(): boolean {
    return this.userRole === "STAFF";
  }

  get canViewOperationalAmounts(): boolean {
    return !this.isStaff;
  }

  get canViewReturnAmounts(): boolean {
    return !this.isStaff;
  }

  get dashboardTitle(): string {
    if (this.isStaff) {
      return "Daily Workboard";
    }
    if (this.isManager) {
      return "Operations Dashboard";
    }
    return "Dashboard Overview";
  }

  get dashboardSubtitle(): string {
    if (this.isStaff) {
      return "Daily activity, orders and stock alerts for current scope";
    }
    if (this.isManager) {
      return "Operational trends, stock watch and recent business activity";
    }
    return "Live business snapshot by current shop context";
  }

  getScopeNote(): string {
    if (this.kpis?.mode === "GLOBAL") {
      return "Auditing all shop data";
    }
    if (this.isStaff) {
      return "Focused on current shop daily work";
    }
    if (this.isManager) {
      return "Focused on current shop operations";
    }
    return "Focused on selected shop performance";
  }

  loadOverview() {
    this.dashboardService.getOverview().subscribe({
      next: (res: any) => {
        this.overview = {
          lowStockItems: res?.data?.lowStockItems || [],
          recentOrders: res?.data?.recentOrders || [],
          recentSales: res?.data?.recentSales || [],
          topSellingProducts: res?.data?.topSellingProducts || [],
          recentPayments: res?.data?.recentPayments || [],
          dueSummary: res?.data?.dueSummary || null,
        };
      },
      error: () => {
        this.overview = {
          lowStockItems: [],
          recentOrders: [],
          recentSales: [],
          topSellingProducts: [],
          recentPayments: [],
          dueSummary: null,
        };
      },
    });
  }

  loadTrends() {
    this.dashboardService.getTrends(this.trendDays).subscribe({
      next: (res: any) => {
        const data = res?.data || {};
        this.renderTrendCharts(
          data.labels || [],
          data.sales || [],
          data.orders || [],
          data.purchase || [],
        );
      },
      error: () => {
        this.renderTrendCharts([], [], [], []);
      },
    });
  }

  loadInventorySummary() {
    forkJoin({
      products: this.productService.getAllProducts(),
      categories: this.categoryService.getAllCategories({ page: 1, limit: 1 }),
      brands: this.brandService.getAllBrands({ page: 1, limit: 1 }),
    }).subscribe({
      next: (res: any) => {
        this.inventorySummary.products = this.extractCount(res?.products, ["data"]);
        this.inventorySummary.categories = this.extractCount(res?.categories, [
          "data",
          "items",
          "categories",
        ]);
        this.inventorySummary.brands = this.extractCount(res?.brands, [
          "data",
          "items",
          "brands",
        ]);
      },
      error: () => {
        this.inventorySummary = { products: 0, categories: 0, brands: 0 };
      },
    });
  }

  loadPurchaseAnalytics() {
    this.dashboardService.getPurchaseAnalytics().subscribe({
      next: (res: any) => {
        const data = res?.data || {};
        this.purchaseAnalytics = {
          today: data.today || this.purchaseAnalytics.today,
          weekly: data.weekly || this.purchaseAnalytics.weekly,
          monthly: data.monthly || this.purchaseAnalytics.monthly,
        };
        this.renderPurchaseAnalyticsChart();
      },
      error: () => {
        this.purchaseAnalytics = {
          today: { totalAmount: 0, totalPaid: 0, totalDue: 0, count: 0 },
          weekly: { totalAmount: 0, totalPaid: 0, totalDue: 0, count: 0 },
          monthly: { totalAmount: 0, totalPaid: 0, totalDue: 0, count: 0 },
        };
        this.renderPurchaseAnalyticsChart();
      },
    });
  }

  loadReturnAnalytics() {
    this.dashboardService.getReturnAnalytics().subscribe({
      next: (res: any) => {
        const data = res?.data || {};
        this.returnAnalytics = {
          today: data.today || this.returnAnalytics.today,
          weekly: data.weekly || this.returnAnalytics.weekly,
          monthly: data.monthly || this.returnAnalytics.monthly,
        };
      },
      error: () => {
        this.returnAnalytics = {
          today: { totalAmount: 0, totalRefund: 0, totalCredit: 0, totalQty: 0, count: 0 },
          weekly: { totalAmount: 0, totalRefund: 0, totalCredit: 0, totalQty: 0, count: 0 },
          monthly: { totalAmount: 0, totalRefund: 0, totalCredit: 0, totalQty: 0, count: 0 },
        };
      },
    });
  }

  private renderTrendCharts(
    labels: string[],
    salesSeries: number[],
    ordersSeries: number[],
    purchaseSeries: number[],
  ) {
    const finalLabels = labels.length ? labels : ["-", "-", "-", "-", "-", "-", "-"];
    const finalSales = salesSeries.length ? salesSeries : [0, 0, 0, 0, 0, 0, 0];
    const finalOrders = ordersSeries.length ? ordersSeries : [0, 0, 0, 0, 0, 0, 0];
    const finalPurchase = purchaseSeries.length ? purchaseSeries : [0, 0, 0, 0, 0, 0, 0];

    const salesChart = new Chartist.Line(
      "#dailySalesChart",
      { labels: finalLabels, series: [finalSales] },
      {
        lineSmooth: Chartist.Interpolation.cardinal({ tension: 0 }),
        showPoint: true,
        low: 0,
        chartPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    );
    this.attachPointTooltips(salesChart, finalLabels, finalSales, "₹ ");
    this.startAnimationForLineChart(salesChart);

    const ordersChart = new Chartist.Bar(
      "#websiteViewsChart",
      { labels: finalLabels, series: [finalOrders] },
      {
        axisX: { showGrid: false },
        low: 0,
        chartPadding: { top: 0, right: 5, bottom: 0, left: 0 },
      },
    );
    this.attachPointTooltips(ordersChart, finalLabels, finalOrders);
    this.startAnimationForBarChart(ordersChart);

    const purchaseChart = new Chartist.Line(
      "#completedTasksChart",
      { labels: finalLabels, series: [finalPurchase] },
      {
        lineSmooth: Chartist.Interpolation.cardinal({ tension: 0 }),
        showPoint: true,
        low: 0,
        chartPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    );
    this.attachPointTooltips(purchaseChart, finalLabels, finalPurchase, "₹ ");
    this.startAnimationForLineChart(purchaseChart);
  }

  onShopChange(event: any) {
    const shopId = event.target.value;
    const selectedShopObj = this.shops.find((shop: any) => shop._id === shopId);
    if (shopId) {
      this.shopService.setSelectedShop(shopId, selectedShopObj?.shopCode || null);
    } else {
      this.shopService.clearSelectedShop();
    }
    this.selectedShop = shopId;

    this.loadKpis();
    this.loadOverview();
    this.loadTrends();
    this.loadInventorySummary();
    if (this.canViewSensitivePricing) {
      this.loadPurchaseAnalytics();
    }
    this.loadReturnAnalytics();
  }

  goToRoute(path: string): void {
    this.router.navigateByUrl(path);
  }

  openOrder(order: any): void {
    const id = `${order?._id || order?.id || ""}`.trim();
    if (!id) {
      this.goToRoute("/order");
      return;
    }
    this.router.navigate(["/order", id]);
  }

  openSale(): void {
    this.goToRoute("/sale-list");
  }

  openProducts(): void {
    this.goToRoute("/item-list");
  }

  openStocks(): void {
    this.goToRoute("/stocks");
  }

  openPurchase(): void {
    this.goToRoute("/purchase");
  }

  openOrders(): void {
    this.goToRoute("/order");
  }

  openReturns(): void {
    this.goToRoute("/returns");
  }

  openCustomers(): void {
    this.goToRoute("/customer");
  }

  openReports(): void {
    this.goToRoute("/sales-reports");
  }

  goToProducts(): void {
    this.router.navigateByUrl("/item-list");
  }

  trackById(index: number, row: any): string {
    return row?.id || row?._id || `${index}`;
  }

  getScopeLabel(): string {
    if (this.isSuperAdmin && !this.selectedShop) {
      return "Global Mode";
    }
    return "Shop Mode";
  }

  private extractCount(response: any, arrayKeys: string[] = ["data", "items"]): number {
    if (typeof response?.total === "number") return response.total;
    if (typeof response?.totalItems === "number") return response.totalItems;
    if (typeof response?.count === "number") return response.count;
    if (typeof response?.pagination?.total === "number") return response.pagination.total;
    for (const key of arrayKeys) {
      if (Array.isArray(response?.[key])) return response[key].length;
    }
    if (Array.isArray(response)) return response.length;
    return 0;
  }

  private renderPurchaseAnalyticsChart(): void {
    const values = [
      Number(this.purchaseAnalytics?.today?.totalAmount || 0),
      Number(this.purchaseAnalytics?.weekly?.totalAmount || 0),
      Number(this.purchaseAnalytics?.monthly?.totalAmount || 0),
    ];

    const chart = new Chartist.Bar(
      "#purchaseAnalyticsChart",
      {
        labels: ["Today", "Weekly", "Monthly"],
        series: [values],
      },
      {
        axisX: { showGrid: false },
        low: 0,
        chartPadding: { top: 0, right: 8, bottom: 0, left: 0 },
      },
    );
    this.attachPointTooltips(chart, ["Today", "Weekly", "Monthly"], values, "₹ ");
    this.startAnimationForBarChart(chart);
  }
}
