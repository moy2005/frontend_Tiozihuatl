import { CommonModule } from '@angular/common';
import { Component,CUSTOM_ELEMENTS_SCHEMA,ViewEncapsulation  } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None  

})
export class Footer {

}
