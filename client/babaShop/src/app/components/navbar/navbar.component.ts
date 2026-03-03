import { Component, OnInit, ElementRef } from "@angular/core";
import { ROUTES } from "../sidebar/sidebar.component";
import { ShopService } from "../../shared/services/shop.service";
import { AuthService } from "../../shared/services/auth.service";
import { Location } from "@angular/common";
import { Router } from "@angular/router";

interface NavbarLink {
  title: string;
  path: string | null;
  icon: string;
}

@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.component.html",
  styleUrls: ["./navbar.component.css"],
})
export class NavbarComponent implements OnInit {
  shops: any[] = [];
  selectedShop: string | null = null;
  isSuperAdmin: boolean = false;
  navLinks: NavbarLink[] = [];
  location: Location;
  mobile_menu_visible: any = 0;
  private toggleButton: any;
  private sidebarVisible: boolean;
  private listTitles: any[];

  constructor(
    location: Location,
    private element: ElementRef,
    private router: Router,
    private shopService: ShopService,
    private authService: AuthService,
  ) {
    this.location = location;
    this.sidebarVisible = false;
  }

  ngOnInit() {
    this.listTitles = ROUTES.filter((listTitle) => listTitle);
    const navbar: HTMLElement = this.element.nativeElement;
    this.toggleButton = navbar.getElementsByClassName("navbar-toggler")[0];
    this.router.events.subscribe((event) => {
      this.sidebarClose();
      var $layer: any = document.getElementsByClassName("close-layer")[0];
      if ($layer) {
        $layer.remove();
        this.mobile_menu_visible = 0;
      }
    });
    this.isSuperAdmin = this.authService.getUserRole() === "SUPER_ADMIN";
    this.selectedShop = this.shopService.getSelectedShop();
    this.navLinks = this.getRoleBasedLinks();
    this.shopService.selectedShop$.subscribe((shopId) => {
      this.selectedShop = shopId;
    });

    if (this.isSuperAdmin) {
      this.loadShops();
    }
  }

  loadShops() {
    this.shopService.getAllShops().subscribe((res: any) => {
      this.shops = Array.isArray(res?.data) ? res.data : [];
    });
  }

  onShopChange(shopId: string) {
    const selectedShopObj = this.shops.find((shop: any) => shop._id === shopId);
    this.shopService.setSelectedShop(shopId, selectedShopObj?.shopCode || null);
    window.location.reload();
  }

  clearShopSelection() {
    this.shopService.clearSelectedShop();
    window.location.reload();
  }

  getCurrentShopLabel(): string {
    if (!this.selectedShop) {
      return this.isSuperAdmin ? "Global View" : "No Shop";
    }
    const selected = this.shops.find((shop: any) => shop._id === this.selectedShop);
    if (!selected) return this.selectedShop;
    return `${selected.name}${selected.shopCode ? ` (${selected.shopCode})` : ""}`;
  }

  navigateTo(path: string | null) {
    if (!path) return;
    this.router.navigateByUrl(path);
  }

  private getRoleBasedLinks(): NavbarLink[] {
    if (this.isSuperAdmin) {
      return [
        { title: "Dashboard", path: "/dashboard", icon: "dashboard" },
        { title: "Subscriptions", path: "/settings", icon: "credit_card" },
        { title: "Reports", path: "/sale-list", icon: "analytics" },
        { title: "Settings", path: "/settings", icon: "settings" },
      ];
    }

    return [
      { title: "Dashboard", path: "/dashboard", icon: "dashboard" },
      { title: "Products", path: "/item-list", icon: "inventory_2" },
      { title: "Sales", path: "/sale-list", icon: "point_of_sale" },
      { title: "Purchase", path: "/stocks", icon: "shopping_cart" },
      { title: "Customers", path: "/customer", icon: "people" },
      { title: "Reports", path: "/sale-list", icon: "analytics" },
    ];
  }

  sidebarOpen() {
    const toggleButton = this.toggleButton;
    const body = document.getElementsByTagName("body")[0];
    setTimeout(function () {
      toggleButton.classList.add("toggled");
    }, 500);

    body.classList.add("nav-open");

    this.sidebarVisible = true;
  }
  sidebarClose() {
    const body = document.getElementsByTagName("body")[0];
    this.toggleButton.classList.remove("toggled");
    this.sidebarVisible = false;
    body.classList.remove("nav-open");
  }
  sidebarToggle() {
    // const toggleButton = this.toggleButton;
    // const body = document.getElementsByTagName('body')[0];
    var $toggle = document.getElementsByClassName("navbar-toggler")[0];

    if (this.sidebarVisible === false) {
      this.sidebarOpen();
    } else {
      this.sidebarClose();
    }
    const body = document.getElementsByTagName("body")[0];

    if (this.mobile_menu_visible == 1) {
      // $('html').removeClass('nav-open');
      body.classList.remove("nav-open");
      if ($layer) {
        $layer.remove();
      }
      setTimeout(function () {
        $toggle.classList.remove("toggled");
      }, 400);

      this.mobile_menu_visible = 0;
    } else {
      setTimeout(function () {
        $toggle.classList.add("toggled");
      }, 430);

      var $layer = document.createElement("div");
      $layer.setAttribute("class", "close-layer");

      if (body.querySelectorAll(".main-panel")) {
        document.getElementsByClassName("main-panel")[0].appendChild($layer);
      } else if (body.classList.contains("off-canvas-sidebar")) {
        document
          .getElementsByClassName("wrapper-full-page")[0]
          .appendChild($layer);
      }

      setTimeout(function () {
        $layer.classList.add("visible");
      }, 100);

      $layer.onclick = function () {
        //asign a function
        body.classList.remove("nav-open");
        this.mobile_menu_visible = 0;
        $layer.classList.remove("visible");
        setTimeout(function () {
          $layer.remove();
          $toggle.classList.remove("toggled");
        }, 400);
      }.bind(this);

      body.classList.add("nav-open");
      this.mobile_menu_visible = 1;
    }
  }

  getTitle() {
    var titlee = this.location.prepareExternalUrl(this.location.path());
    if (titlee.charAt(0) === "#") {
      titlee = titlee.slice(1);
    }

    for (var item = 0; item < this.listTitles.length; item++) {
      if (this.listTitles[item].path === titlee) {
        return this.listTitles[item].title;
      }
    }
    return "Dashboard";
  }
}
