text_string="Mickey";
font_name="Comic Neue:style=Bold";
letter_height=12;
letter_thickness=1.4;
base_height=12;
outline_margin=2.3;
hole_orientation="FRONTBACK";
hole_diameter=7.8;
hole_length=150;
hole_x=21;
hole_y=4;
hole_z=base_height/2;
rtl=false;
text_halign=rtl?"right":"left";
part="all";
module base_with_tunnel(){
 difference(){
  linear_extrude(height=base_height)
   offset(delta=outline_margin)
    text(text_string,size=letter_height,font=font_name,halign=text_halign,valign="baseline");
  if(hole_orientation=="FRONTBACK")
   translate([0,hole_y,hole_z])rotate([0,90,0])cylinder(d=hole_diameter,h=hole_length,center=true,$fn=100);
  else if(hole_orientation=="TOPBOTTOM")
   translate([hole_x,0,hole_z])rotate([90,0,0])cylinder(d=hole_diameter,h=hole_length,center=true,$fn=100);
 }
}
module raised_letters(){
 translate([0,0,base_height])linear_extrude(height=letter_thickness)
  text(text_string,size=letter_height,font=font_name,halign=text_halign,valign="baseline");
}
if(part=="base")base_with_tunnel();
else if(part=="letters")raised_letters();
else union(){base_with_tunnel();raised_letters();}
