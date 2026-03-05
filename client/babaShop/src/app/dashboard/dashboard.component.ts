import { Component, OnInit } from "@angular/core";
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
export class DashboardComponent implements OnInit {
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

  ngOnInit() {
    this.selectedShop = this.shopService.getSelectedShop();
    this.isSuperAdmin = this.authService.isSuperAdmin();

    if (this.isSuperAdmin) {
      this.loadShops();
    }
    this.loadKpis();
    this.loadTrends();
    this.loadInventorySummary();
    this.loadPurchaseAnalytics();
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
        this.loadTrends();
        this.loadInventorySummary();
        this.loadPurchaseAnalytics();
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
        low: 0,
        chartPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    );
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
    this.startAnimationForBarChart(ordersChart);

    const purchaseChart = new Chartist.Line(
      "#completedTasksChart",
      { labels: finalLabels, series: [finalPurchase] },
      {
        lineSmooth: Chartist.Interpolation.cardinal({ tension: 0 }),
        low: 0,
        chartPadding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    );
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
    this.loadTrends();
    this.loadInventorySummary();
    this.loadPurchaseAnalytics();
  }

  goToProducts(): void {
    this.router.navigateByUrl("/item-list");
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
    this.startAnimationForBarChart(chart);
  }
}
