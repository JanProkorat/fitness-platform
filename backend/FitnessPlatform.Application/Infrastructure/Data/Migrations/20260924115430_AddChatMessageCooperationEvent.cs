using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessPlatform.Application.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddChatMessageCooperationEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "last_message_event_type",
                table: "conversations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "event_source_id",
                table: "chat_messages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "event_type",
                table: "chat_messages",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "kind",
                table: "chat_messages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "ix_chat_messages_conversation_id_event_type_event_source_id",
                table: "chat_messages",
                columns: new[] { "conversation_id", "event_type", "event_source_id" },
                unique: true,
                filter: "event_source_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_chat_messages_conversation_id_event_type_event_source_id",
                table: "chat_messages");

            migrationBuilder.DropColumn(
                name: "last_message_event_type",
                table: "conversations");

            migrationBuilder.DropColumn(
                name: "event_source_id",
                table: "chat_messages");

            migrationBuilder.DropColumn(
                name: "event_type",
                table: "chat_messages");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "chat_messages");
        }
    }
}
