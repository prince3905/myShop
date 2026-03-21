import { Component, OnInit } from '@angular/core';
import { AuthService } from './shared/services/auth.service';
import { Router } from '@angular/router';
import { ConnectivityService } from './shared/services/connectivity.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  serverReachable: boolean | null = null;
  checkingServer = false;
  activeApiURL = '';

  constructor(
    private authService: AuthService,
    public router: Router,
    private connectivityService: ConnectivityService,
  ) {
    this.authService.initializeSessionWatch();
  }

  ngOnInit(): void {
    this.connectivityService.startMonitoring();
    this.connectivityService.serverReachable$.subscribe((reachable) => {
      this.serverReachable = reachable;
    });
    this.connectivityService.checking$.subscribe((checking) => {
      this.checkingServer = checking;
    });
    this.connectivityService.activeApiURL$.subscribe((url) => {
      this.activeApiURL = url;
    });
  }

  retryConnection(): void {
    this.connectivityService.checkNow();
  }

  openApiSettings(): void {
    if (this.router.url !== '/settings') {
      this.router.navigate(['/settings']);
    }
  }
}
