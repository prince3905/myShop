import { Component, OnInit } from '@angular/core';
import { AuthService } from '../shared/services/auth.service';
import { AnySchema } from 'ajv';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  credentials: any = { email: 'peince0@gmail.com', password: '1Kt12cs080@123' };
  email: string;
  password: string;

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
    ) { }

  ngOnInit(): void {
  }

  onSubmit(): void {
    this.authService.login(this.email, this.password).subscribe(
      (response) => {
        console.log('Login successful:', response);
        this.router.navigate(['/dashboard']);
      },
      (error) => {
        console.error('Login failed:', error);
        this.snackBar.open('Login failed. Please check your email and password.', 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });
      }
    );
  }

}
