import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/shared/services/auth.service';


declare const $: any;
declare interface RouteInfo {
    path: string;
    title: string;
    icon: string;
    class: string;
}
export const ROUTES: RouteInfo[] = [
    { path: '/dashboard', title: 'Dashboard',  icon: 'dashboard', class: '' },
    { path: '/user-profile', title: 'User Profile',  icon:'person', class: '' },
    { path: '/item-list', title: 'Product',  icon:'content_paste', class: '' },
    { path: '/sale-list', title: 'Sales',  icon:'store', class: '' },
    { path: '/stocks', title: 'Stock',  icon:'poll', class: '' },
];

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  menuItems: any[];

  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit() {
    this.menuItems = ROUTES.filter(menuItem => menuItem);
  }
  isMobileMenu() {
      if ($(window).width() > 991) {
          return false;
      }
      return true;
  };
  logout(): void {
    // Implement your logout logic here (e.g., clear user session, token, etc.)

    // After logout, redirect to the login page
    this.router.navigate(["/login"]);
    this.auth.logout().subscribe(
      (response) => {
        console.log(response);
        this.router.navigate(["/login"]);
      },
      (error) => {
        console.error("Login failed:", error);
        // Handle login error here (e.g., show error message to the user)
      }
    );
  }
}
