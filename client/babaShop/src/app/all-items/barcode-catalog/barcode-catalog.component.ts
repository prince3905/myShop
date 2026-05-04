import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy, Renderer2, Inject, DOCUMENT } from '@angular/core';
import { VariationService } from 'app/shared/services/variation.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-barcode-catalog',
  templateUrl: './barcode-catalog.component.html',
  styleUrls: ['./barcode-catalog.component.css']
})
export class BarcodeCatalogComponent implements OnInit, AfterViewInit, OnDestroy {
  quickAddItems: any[] = [];
  isLoading: boolean = true;
  @ViewChild('scrollDiv') scrollDiv!: ElementRef;
  private resizeListener: any;
  private parentEl: HTMLElement | null = null;

  constructor(
    private variationService: VariationService,
    private snackBar: MatSnackBar,
    private sanitizer: DomSanitizer,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  ngAfterViewInit(): void {
    // Force parent containers to allow scroll
    setTimeout(() => {
      // Find parent elements and make them scrollable
      const host = this.document.querySelector('app-barcode-catalog');
      if (host) {
        this.renderer.setStyle(host, 'height', '100vh');
        this.renderer.setStyle(host, 'display', 'block');
        this.renderer.setStyle(host, 'overflow', 'hidden');
      }

      const parent = host?.parentElement;
      if (parent) {
        this.renderer.setStyle(parent, 'height', '100vh');
        this.renderer.setStyle(parent, 'overflow', 'hidden');
      }

      if (this.scrollDiv?.nativeElement) {
        const vh = window.innerHeight;
        this.renderer.setStyle(this.scrollDiv.nativeElement, 'height', `${vh - 180}px`);
        this.renderer.setStyle(this.scrollDiv.nativeElement, 'overflow-y', 'auto');
        this.renderer.setStyle(this.scrollDiv.nativeElement, 'display', 'block');
      }
    }, 200);

    this.resizeListener = () => {
      if (this.scrollDiv?.nativeElement) {
        const vh = window.innerHeight;
        this.renderer.setStyle(this.scrollDiv.nativeElement, 'height', `${vh - 180}px`);
      }
    };
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  loadCatalog(): void {
    this.isLoading = true;
    this.variationService.getVariations({ isQuickAdd: true }).subscribe({
      next: (res: any) => {
        this.quickAddItems = res?.data || res || [];
        this.isLoading = false;
      },
      error: (err) => {
        this.snackBar.open("Failed to load catalog", "Close", { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  printCatalog(): void {
    window.print();
  }

  generateEan13Svg(rawCode: string): SafeHtml {
    const code = rawCode.replace(/\D/g, "").slice(0, 13);
    if (code.length !== 13) {
      return this.sanitizer.bypassSecurityTrustHtml('<div style="font-size:10px;color:#999;text-align:center">Invalid</div>');
    }

    const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
    const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
    const R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
    const PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

    const first = Number(code[0]);
    const left = code.slice(1, 7).split("").map((d: string) => Number(d));
    const right = code.slice(7).split("").map((d: string) => Number(d));
    const parityPattern = PARITY[first];

    let bits = "101";
    for (let i = 0; i < left.length; i += 1) {
      bits += parityPattern[i] === "L" ? L[left[i]] : G[left[i]];
    }
    bits += "01010";
    for (let i = 0; i < right.length; i += 1) {
      bits += R[right[i]];
    }
    bits += "101";

    const barW = 1.05;
    const h = 50;
    const w = bits.length * barW;
    let x = 0;
    let rects = "";
    for (const bit of bits) {
      if (bit === "1") {
        rects += `<rect x="${x.toFixed(2)}" y="0" width="${barW}" height="${h}" fill="#000"/>`;
      }
      x += barW;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(2)} ${h}" preserveAspectRatio="none" style="width:100%;max-width:180px;height:auto;">${rects}</svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
