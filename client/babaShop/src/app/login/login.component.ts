import { Component, OnInit } from '@angular/core';
import { AuthService } from '../shared/services/auth.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  // Default credentials (for testing ease)
  credentials: any = { email: 'peince0@gmail.com', password: '1Kt12cs080@123' };
  
  email: string = '';
  password: string = '';
  shopCode : string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
   if (this.authService.isLoggedIn()) {
    this.router.navigate(['/dashboard']);
  }
  }

  
onSubmit(): void {
  if (!this.shopCode || !this.email || !this.password) {
    return;
  }

  this.authService
    .login(this.shopCode, this.email, this.password)
    .subscribe(
      (response) => {
        this.router.navigate(['/dashboard']);
      },
      (error) => {
        this.snackBar.open(
          'Login failed. Please check credentials.',
          'Close',
          { duration: 4000 }
        );
      }
    );
}


}