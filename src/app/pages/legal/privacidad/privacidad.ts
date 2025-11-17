import { Component, CUSTOM_ELEMENTS_SCHEMA,ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-privacidad',
  standalone: true,
   imports: [RouterModule],
  templateUrl: './privacidad.html',
  styleUrls: ['./privacidad.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class Privacidad {}
