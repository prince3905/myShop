import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { Location, PopStateEvent } from '@angular/common';
import { Router, NavigationEnd, NavigationStart, Event as RouterEvent } from '@angular/router';
import PerfectScrollbar from 'perfect-scrollbar';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
  private _router: Subscription;
  private _navigationSubscription: Subscription;
  private lastPoppedUrl: string | undefined;
  private yScrollStack: number[] = [];
  private mainPanelScrollbar?: PerfectScrollbar;
  private sidebarScrollbar?: PerfectScrollbar;

  constructor( public location: Location, private router: Router) {}

  ngOnInit() {
      const isWindows = navigator.platform.indexOf('Win') > -1;

      if (isWindows && !document.body.classList.contains('sidebar-mini')) {
          document.body.classList.add('perfect-scrollbar-on');
      } else {
          document.body.classList.remove('perfect-scrollbar-off');
      }

      this._navigationSubscription = this.router.events.subscribe((event: RouterEvent) => {
          if (event instanceof NavigationStart) {
             if (event.url !== this.lastPoppedUrl) {
                 this.yScrollStack.push(window.scrollY);
             }
          } else if (event instanceof NavigationEnd) {
             if (event.url === this.lastPoppedUrl) {
                 this.lastPoppedUrl = undefined;
                 window.scrollTo(0, this.yScrollStack.pop());
             } else {
                 window.scrollTo(0, 0);
             }
          }
      });

      this._router = this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
           const mainPanel = document.querySelector('.main-panel') as HTMLElement | null;
           const sidebar = document.querySelector('.sidebar .sidebar-wrapper') as HTMLElement | null;
           if (mainPanel) mainPanel.scrollTop = 0;
           if (sidebar) sidebar.scrollTop = 0;
           this.mainPanelScrollbar?.update();
           this.sidebarScrollbar?.update();
      });
  }

  ngAfterViewInit() {
      if (window.matchMedia('(min-width: 960px)').matches && !this.isMac()) {
          const mainPanel = document.querySelector('.main-panel') as HTMLElement | null;
          const sidebar = document.querySelector('.sidebar .sidebar-wrapper') as HTMLElement | null;

          if (mainPanel && sidebar) {
              this.mainPanelScrollbar = new PerfectScrollbar(mainPanel);
              this.sidebarScrollbar = new PerfectScrollbar(sidebar);
          }
      }
  }

  runOnRouteChange(): void {
    this.mainPanelScrollbar?.update();
    this.sidebarScrollbar?.update();
  }

  isMaps(path: string): boolean {
      return this.location.prepareExternalUrl(this.location.path()) === `/${path}`;
  }

  isMac(): boolean {
      return /MAC|IPAD/i.test(navigator.platform.toUpperCase());
  }

  ngOnDestroy(): void {
      this._router?.unsubscribe();
      this._navigationSubscription?.unsubscribe();
      this.mainPanelScrollbar?.destroy();
      this.sidebarScrollbar?.destroy();
  }
}
