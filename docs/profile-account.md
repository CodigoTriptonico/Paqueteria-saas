# Mi perfil

`/perfil` está disponible para cada cuenta autenticada, sin requerir permisos de Configuración. La pantalla muestra empresa, rol y permisos activos, y permite que cada persona actualice su nombre, su foto y su contraseña.

- La contraseña exige la clave actual, una nueva de al menos 8 caracteres y su confirmación.
- Las fotos se guardan en el bucket privado `profile-avatars`, bajo el ID de la propia cuenta. Solo se aceptan JPG, PNG o WebP de hasta 4 MB y la aplicación las entrega con una URL firmada.
- El correo y el rol son informativos: los gestiona el administrador de la empresa para evitar que alguien cambie su propio nivel de acceso.
