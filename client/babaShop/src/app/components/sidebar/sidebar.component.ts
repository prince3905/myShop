import { Component, Inject, OnDestroy, OnInit, Renderer2 } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "app/shared/services/auth.service";

declare const $: any;

declare interface RouteInfo {
  path?: string;
  title: string;
  icon: string;
  class?: string;
  roles: string[];
  children?: RouteInfo[];
  expanded?: boolean; // 🔥 YE LINE ADD KARO
}

export const ROUTES: RouteInfo[] = [
  {
    path: "/dashboard",
    title: "Dashboard",
    icon: "dashboard",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
  },

  {
    title: "Inventory",
    icon: "inventory_2",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    children: [
      {
        path: "/item-list",
        title: "Products",
        icon: "content_paste",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
      },
      {
        path: "/stocks",
        title: "Stocks",
        icon: "poll",
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        path: "/purchase",
        title: "Purchase",
        icon: "shopping_cart",
        roles: ["SUPER_ADMIN"],
      },
    ],
  },

  {
    title: "Sales",
    icon: "store",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
    children: [
      {
        path: "/sale-list",
        title: "Sales",
        icon: "store",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
      },
      {
        path: "/order",
        title: "Orders",
        icon: "rate_review",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
      },
      {
        path: "/pos",
        title: "POS",
        icon: "point_of_sale",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
      },
      {
        path: "/returns",
        title: "Returns",
        icon: "undo",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
      },
    ],
  },

  {
    title: "People",
    icon: "groups",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    children: [
      {
        path: "/users",
        title: "Users",
        icon: "manage_accounts",
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        path: "/customer",
        title: "Customers",
        icon: "supervised_user_circle",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
      },
      {
        path: "/distributor",
        title: "Distributors",
        icon: "supervisor_account",
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },

  {
    title: "Account",
    icon: "account_circle",
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    children: [
      {
        path: "/profile",
        title: "Profile",
        icon: "manage_accounts",
        roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
      },
      {
        path: "/settings",
        title: "Settings",
        icon: "settings",
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
];

@Component({
  selector: "app-sidebar",
  templateUrl: "./sidebar.component.html",
  styleUrls: ["./sidebar.component.css"],
})
export class SidebarComponent implements OnInit, OnDestroy {
  menuItems: any[];
  userRole: string | null = null;
  isCollapsed = false;
  activeFlyoutKey: string | null = null;
  private readonly collapseKey = "sidebar_collapsed";
  private sidebarEl: HTMLElement | null = null;
  private mainPanelEl: HTMLElement | null = null;

  constructor(
    private router: Router,
    private auth: AuthService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  ngOnInit() {
    this.userRole = this.auth.getUserRole();
    this.menuItems = this.filterMenuByRole(ROUTES);
    this.sidebarEl = this.document.querySelector(".sidebar");
    this.mainPanelEl = this.document.querySelector(".main-panel");
    this.restoreCollapseState();
  }

  ngOnDestroy(): void {
    // Keep layout class in sync when component is recreated.
    this.syncBodyClass();
  }

  filterMenuByRole(items: RouteInfo[]): RouteInfo[] {
    return items
      .filter((item) => item.roles.includes(this.userRole!))
      .map((item) => {
        if (item.children) {
          item.children = item.children.filter((child) =>
            child.roles.includes(this.userRole!),
          );
        }
        return item;
      });
  }
  isMobileMenu() {
    if ($(window).width() > 991) {
      return false;
    }
    return true;
  }
  logout(): void {
    this.auth.removeToken();
    this.auth.removeUser();
    this.auth.removeSelectedShop();
    this.router.navigate(["/login"]);
  }

  toggleMenu(menuItem: RouteInfo) {
    if (this.isCollapsed) return;

    this.menuItems.forEach((item) => {
      if (item !== menuItem) {
        item.expanded = false;
      }
    });

    menuItem.expanded = !menuItem.expanded;
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    if (!this.isCollapsed) {
      this.activeFlyoutKey = null;
    }
    localStorage.setItem(this.collapseKey, String(this.isCollapsed));
    this.syncBodyClass();
  }

  getTooltip(title: string): string {
    return this.isCollapsed ? title : "";
  }

  openFlyout(menuItem: RouteInfo, idx: number): void {
    if (!this.isCollapsed || !menuItem?.children?.length) return;
    this.activeFlyoutKey = this.getFlyoutKey(menuItem, idx);
  }

  closeFlyout(menuItem?: RouteInfo, idx?: number): void {
    if (!this.isCollapsed) return;
    if (!menuItem || idx === undefined) {
      this.activeFlyoutKey = null;
      return;
    }
    const key = this.getFlyoutKey(menuItem, idx);
    if (this.activeFlyoutKey === key) {
      this.activeFlyoutKey = null;
    }
  }

  isFlyoutOpen(menuItem: RouteInfo, idx: number): boolean {
    if (!this.isCollapsed) return !!menuItem?.expanded;
    return this.activeFlyoutKey === this.getFlyoutKey(menuItem, idx);
  }

  private restoreCollapseState(): void {
    const saved = localStorage.getItem(this.collapseKey);
    this.isCollapsed = saved === "true";
    this.syncBodyClass();
  }

  private getFlyoutKey(menuItem: RouteInfo, idx: number): string {
    return `${menuItem?.title || "menu"}-${idx}`;
  }

  private syncBodyClass(): void {
    if (this.isCollapsed) {
      this.renderer.addClass(this.document.body, "sidebar-mini");
      this.applyCollapsedDimensions();
    } else {
      this.renderer.removeClass(this.document.body, "sidebar-mini");
      this.clearCollapsedDimensions();
    }
  }

  private applyCollapsedDimensions(): void {
    if (this.sidebarEl) {
      this.renderer.setStyle(this.sidebarEl, "width", "80px");
      this.renderer.setStyle(this.sidebarEl, "min-width", "80px");
      this.renderer.setStyle(this.sidebarEl, "max-width", "80px");
    }
    if (this.mainPanelEl) {
      this.renderer.setStyle(this.mainPanelEl, "width", "calc(100% - 80px)");
    }
  }

  private clearCollapsedDimensions(): void {
    if (this.sidebarEl) {
      this.renderer.removeStyle(this.sidebarEl, "width");
      this.renderer.removeStyle(this.sidebarEl, "min-width");
      this.renderer.removeStyle(this.sidebarEl, "max-width");
    }
    if (this.mainPanelEl) {
      this.renderer.removeStyle(this.mainPanelEl, "width");
    }
  }
}
