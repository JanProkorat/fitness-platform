using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddChatMessageImageAttachment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "last_message_has_image",
                table: "conversations",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "image_blob_url",
                table: "chat_messages",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "image_content_type",
                table: "chat_messages",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "image_height",
                table: "chat_messages",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "image_size_bytes",
                table: "chat_messages",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "image_width",
                table: "chat_messages",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "last_message_has_image",
                table: "conversations");

            migrationBuilder.DropColumn(
                name: "image_blob_url",
                table: "chat_messages");

            migrationBuilder.DropColumn(
                name: "image_content_type",
                table: "chat_messages");

            migrationBuilder.DropColumn(
                name: "image_height",
                table: "chat_messages");

            migrationBuilder.DropColumn(
                name: "image_size_bytes",
                table: "chat_messages");

            migrationBuilder.DropColumn(
                name: "image_width",
                table: "chat_messages");
        }
    }
}
