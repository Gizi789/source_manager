using System.Diagnostics;

namespace GameAccessPluginInstaller;

/// <summary>
/// One-click install: finds Game Access, copies the plugin, writes the source list, the
/// manifest and the execution profile, then tells the user to reopen Game Access.
/// Nothing is registered in Windows and no administrator rights are needed.
/// </summary>
internal static class SilentInstaller
{
    public static int Run()
    {
        var detection = GameAccessDetector.Detect();
        if (!detection.IsInstalled)
        {
            MessageBox.Show(
                "No se encontró Game Access en este equipo. Instalá Game Access primero y volvé a ejecutar este instalador.",
                "Plugin de fuentes", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        }

        try
        {
            // A running plugin keeps its files locked.
            foreach (var process in Process.GetProcessesByName("Game Access Torrent Provider"))
            {
                try { process.Kill(true); process.WaitForExit(4000); } catch { /* already gone */ }
            }

            string target = Path.Combine(detection.PluginsPath, "ga-torrent-provider");
            Directory.CreateDirectory(target);
            Directory.CreateDirectory(detection.AppDataPluginsPath);

            InstallerForm.DeployPluginFiles(target);
            var urls = KnownSources.List.Select(source => source.Url).ToList();
            foreach (var dir in new[] { target, detection.AppDataPluginsPath })
            {
                InstallerForm.WriteSourcesConfig(dir, urls);
                InstallerForm.WriteManifest(dir);
                InstallerForm.WriteExecutionProfiles(dir);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show("No se pudo instalar el plugin: " + ex.Message, "Plugin de fuentes",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 2;
        }

        MessageBox.Show(
            "Plugin instalado.\n\nTenés que volver a abrir Game Access para que el plugin funcione.",
            "Plugin de fuentes", MessageBoxButtons.OK, MessageBoxIcon.Information);
        return 0;
    }
}
