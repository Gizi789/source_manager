namespace GameAccessPluginInstaller;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        // One click by default; pass --wizard for the step-by-step window.
        if (!args.Contains("--wizard", StringComparer.OrdinalIgnoreCase))
        {
            return SilentInstaller.Run();
        }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new InstallerForm());
        return 0;
    }
}
