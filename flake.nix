{
  description = "Notification Hub Monorepo Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = builtins.currentSystem;
      pkgs = import nixpkgs {
        inherit system;
      };
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          # Node.js
          nodejs_26
          nodePackages.pnpm

          # Version Control
          git

          # Containers
          docker
          docker-compose

          # Utilities
          curl
          jq
          openssl
        ];

        shellHook = ''
          clear

          echo "🚀 Notification Hub Development Environment"
          echo "==========================================="
          echo ""
          echo "Node   : $(node --version)"
          echo "npm    : $(npm --version)"
          echo "pnpm   : $(pnpm --version)"
          echo "Git    : $(git --version)"
          echo "Docker : $(docker --version | head -n1)"
          echo ""
          echo "Backend : npm"
          echo "Frontend: pnpm"
          echo ""
        '';
      };
    };
}
