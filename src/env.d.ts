declare namespace App {
  interface Locals {
    adminConfig?: import('./server/admin/auth').AdminConfig;
    adminSession?: import('./server/admin/auth').AdminSession;
  }
}
