import { Component,CUSTOM_ELEMENTS_SCHEMA,ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-seguridad',
  imports: [RouterModule],
  templateUrl: './seguridad.html',
  styleUrl: './seguridad.css',
   schemas: [CUSTOM_ELEMENTS_SCHEMA],
    encapsulation: ViewEncapsulation.None
})
export class Seguridad {

}
