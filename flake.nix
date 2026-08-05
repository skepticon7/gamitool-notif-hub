{
  description = "Notification Hub Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { nixpkgs, ... }:
  let
    system = "x86_64-linux";

    pkgs = import nixpkgs {
      inherit system;
    };
  in {
    devShells.${system}.default = pkgs.mkShell {
      packages = with pkgs; [
        nodejs_26
        pnpm

        git

        docker
        docker-compose

        curl
        jq
        openssl
      ];

      shellHook = ''
        clear
        echo "🚀 Notification Hub Dev Environment"
        echo ""
        echo "Node : $(node -v)"
        echo "npm  : $(npm -v)"
        echo "pnpm : $(pnpm -v)"
        echo ""
      '';
    };
  };
}
