# Respaldos automáticos en GitHub

Windows ejecuta la tarea `PaqueteriaSaasHourlyGitHubBackup` cada hora mientras la sesión de Pablo está activa. La tarea guarda todos los cambios de código, migraciones, documentación y archivos del proyecto que no estén ignorados por Git, aunque el trabajo esté incompleto.

El respaldo crea un commit `backup: automatic snapshot ...` y lo sube a la rama actual en GitHub. Si el equipo estuvo apagado o dormido, se ejecutará en la siguiente hora programada cuando Windows vuelva a estar activo.

No sube archivos `.env`, certificados `.pem` ni `output/` porque pueden contener secretos o son capturas generadas por pruebas. El registro queda en `%LOCALAPPDATA%\PaqueteriaSaas\github-backup.log`.

Para ver un respaldo anterior:

```powershell
git log --oneline
git show <commit>
```

Para volver un archivo a un respaldo concreto:

```powershell
git restore --source <commit> -- ruta/del/archivo
```
