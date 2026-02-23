import { Component, OnInit } from "@angular/core";
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
export class SidebarComponent implements OnInit {
  menuItems: any[];
  userRole: string | null = null;
  isCollapsed = false;

  constructor(
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.userRole = this.auth.getUserRole();
    this.menuItems = this.filterMenuByRole(ROUTES);
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
    this.router.navigate(["/login"]);
  }

  toggleMenu(menuItem: RouteInfo) {
    this.menuItems.forEach((item) => {
      if (item !== menuItem) {
        item.expanded = false;
      }
    });

    menuItem.expanded = !menuItem.expanded;
  }
}
